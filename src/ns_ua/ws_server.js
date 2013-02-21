/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js'),
    WebSocketServer = require('websocket').server,
    fs = require('fs'),
    cluster = require('cluster'),
    crypto = require('../common/cryptography.js'),
    dataManager = require('./datamanager.js'),
    token = require('../common/token.js'),
    helpers = require('../common/helpers.js'),
    msgBroker = require('../common/msgbroker.js'),
    config = require('../config.js').NS_UA_WS,
    consts = require('../config.js').consts,
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesWS = require('../common/constants').errorcodes.UAWS,
    statuscodes = require('../common/constants').statuscodes,
    pages = require('../common/pages.js'),
    url = require('url'),
    http = require('http'),
    https = require('https');

function server(ip, port, ssl) {
  this.ip = ip;
  this.port = port;
  this.ssl = ssl;
  this.ready = false;
  this.tokensGenerated = 0;
  this.wsConnections = 0;
  this.wsMaxConnections = 1000;
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////
  init: function() {

    if (cluster.isMaster) {
      // Fork workers.
      for (var i = 0; i < config.numProcesses; i++) {
        cluster.fork();
      }

      cluster.on('exit', function(worker, code, signal) {
        if (code !== 0) {
          log.error('worker ' + worker.process.pid + ' closed unexpectedly with code ' + code);
        } else {
          log.info('worker ' + worker.process.pid + ' exit');
        }
      });
    } else {
      // Create a new HTTP(S) Server
      if (this.ssl) {
        var options = {
          key: fs.readFileSync(consts.key),
          cert: fs.readFileSync(consts.cert)
        };
        this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
      } else {
        this.server = require('http').createServer(this.onHTTPMessage.bind(this));
      }
      this.server.listen(this.port, this.ip);
      log.info('WS::server::init --> HTTP' + (this.ssl ? 'S' : '') +
               ' push UA_WS server running on ' + this.ip + ':' + this.port);

      // Websocket init
      this.wsServer = new WebSocketServer({
        httpServer: this.server,
        keepalive: config.websocket_params.keepalive,
        keepaliveInterval: config.websocket_params.keepaliveInterval,
        dropConnectionOnKeepaliveTimeout: config.websocket_params.dropConnectionOnKeepaliveTimeout,
        keepaliveGracePeriod: config.websocket_params.keepaliveGracePeriod,
        autoAcceptConnections: false    // false => Use verify originIsAllowed method
      });
      this.wsServer.on('request', this.onWSRequest.bind(this));

      // Subscribe to my own Queue
      var self = this;
      msgBroker.on('brokerconnected', function() {
        var args = {
          durable: false,
          autoDelete: true,
          arguments: {
            'x-ha-policy': 'all'
          }
        };
        msgBroker.subscribe(process.serverId, args, function onNewMessage(message) {
          log.debug('WS::Queue::onNewMessage --> New message received: ' + message);
          var json = {};
          try {
            json = JSON.parse(message);
          } catch (e) {
            log.debug('WS::Queue::onNewMessage --> Not a valid JSON');
            return;
          }
          // If we don't have enough data, return
          if (!json.uaid ||
              !json.messageId ||
              !json.payload) {
            return log.error('WS::queue::onNewMessage --> Not enough data!');
          }
          log.debug('WS::Queue::onNewMessage --> Notifying node:', json.uaid);
          log.notify('Message with id ' + json.messageId + ' sent to ' + json.uaid);
          dataManager.getNode(json.uaid, function(nodeConnector) {
            if (nodeConnector) {
              var notification = json.payload;

              // Not send the appToken
              //TODO: Not insert the appToken into the MQ
              /**
                {
                  messageType: “notification”,
                  updates: [{"channelID": "id", "version": "XXX"}, ...]
                }

                {
                  messageType: "desktopNotification",
                  updates: [{"channelID": "version", _internal_id: ..., "body": "body"}, ...]
                }
              */
              delete notification.appToken;
              log.debug('WS::Queue::onNewMessage --> Sending messages:', notification);
              if (notification.body) {
                nodeConnector.notify({
                  messageType: "desktopNotification",
                  updates: new Array(notification)
                });
              } else {
                nodeConnector.notify({
                  messageType: "notification",
                  updates: new Array(notification)
                });
              }
            } else {
              log.debug('WS::Queue::onNewMessage --> No node found');
            }
          });
        });
        self.ready = true;
      });
      msgBroker.on('brokerdisconnected', function() {
        log.critical('ns_ws::init --> Broker DISCONNECTED!!');
      });

      //Connect to msgBroker
      process.nextTick(function() {
        msgBroker.init();
      });

      //Check if we are alive
      setTimeout(function() {
        if (!self.ready)
          log.critical('30 seconds has passed and we are not ready, closing');
      }, 30 * 1000); //Wait 30 seconds
    }

    // Check ulimit
    helpers.getMaxFileDescriptors(function(error,ulimit) {
      if (error) {
        return log.error('ulimit error: ' + error);
      }
      log.debug('ulimit = ' + ulimit);
      this.wsMaxConnections = ulimit - 200;
    }.bind(this));

  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    response.res = function responseHTTP(errorCode, html) {
      log.debug('NS_UA_WS::responseHTTP: ', errorCode);
      this.statusCode = errorCode[0];
      this.setHeader('access-control-allow-origin', '*');
      if (html) {
        this.setHeader('Content-Type', 'text/html');
        this.write(html);
      } else {
        if (consts.PREPRODUCTION_MODE) {
          this.setHeader('Content-Type', 'text/plain');
          if (this.statusCode == 200) {
                this.write('{"status":"ACCEPTED"}');
          } else {
            this.write('{"status":"ERROR", "reason":"' + errorCode[1] + '"}');
          }
        }
      }
      return this.end();
    };

    var text = null;
    if (!this.ready) {
      log.info('WS:onHTTPMessage --> Request received but not ready yet');
      return response.res(errorcodes.NOT_READY);
    } else {
      log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
      var url = this.parseURL(request.url);

      log.debug('WS::onHTTPMessage --> Parsed URL:', url);
      switch (url.messageType) {
        case 'about':
          if (consts.PREPRODUCTION_MODE) {
            try {
              var p = new pages();
                  p.setTemplate('views/aboutWS.tmpl');
                  text = p.render(function(t) {
                    switch (t) {
                      case '{{GIT_VERSION}}':
                        return require('fs').readFileSync('version.info');
                      case '{{MODULE_NAME}}':
                        return 'User Agent Frontend';
                      case '{{PARAM_TOKENSGENERATED}}':
                        return this.tokensGenerated;
                      case '{{PARAM_CONNECTIONS}}':
                        return this.wsConnections;
                      case '{{PARAM_MAXCONNECTIONS}}':
                        return this.wsMaxConnections;
                      case '{{PARAM_NUMPROCESSES}}':
                        return config.numProcesses;
                      default:
                        return "";
                    }
                  }.bind(this));
            } catch (e) {
              text = 'No version.info file';
            }
            return response.res(errorcodes.NO_ERROR, text);
          } else {
            return response.res(errorcodes.NOT_ALLOWED_ON_PRODUCTION_SYSTEM);
          }
          break;

        default:
          log.debug('WS::onHTTPMessage --> messageType not recognized');
          return response.res(errorcodesWS.BAD_MESSAGE_NOT_RECOGNIZED);
      }
    }
  },

  //////////////////////////////////////////////
  // WebSocket callbacks
  //////////////////////////////////////////////
  onWSRequest: function(request) {
    // Common variables
    var appToken = null;

    ///////////////////////
    // WS Callbacks
    ///////////////////////
    this.onWSMessage = function(message) {
      connection.res = function responseWS(payload) {
        log.debug('WS::responseWS:', payload);
        var res = {};
        if (payload.extradata) {
          res = payload.extradata;
        }
        if (payload.errorcode[0] > 299) {    // Out of the 2xx series
          if (!res.status) {
            res.status = 'ERROR';
              }
              res.reason = payload.errorcode[1];
        } else {
          if (!res.status) {
            res.status = 'OK';
          }
        }
        connection.sendUTF(JSON.stringify(res));
      };

      if (message.type === 'utf8') {
        log.debug('WS::onWSMessage --> Received Message: ' + message.utf8Data);
        if (message.utf8Data == 'PING') {
          return connection.sendUTF('PONG');
        }
        var query = null;
        try {
          query = JSON.parse(message.utf8Data);
        } catch (e) {
          log.debug('WS::onWSMessage --> Data received is not a valid JSON package');
          connection.res({
            errorcode: errorcodesWS.NOT_VALID_JSON_PACKAGE
          });
          return connection.close();
        }

        //Check for uaid in the connection
        if (!connection.uaid && query.messageType !== 'hello') {
          log.debug('WS:onWSMessage --> No uaid for this connection');
          connection.res({
            errorcode: errorcodesWS.UAID_NOT_FOUND,
            extradata: { messageType: query.messageType }
          });
          connection.close();
          return;
        }

        // Restart autoclosing timeout
        dataManager.getNode(connection.uaid, function(nodeConnector) {
          if(nodeConnector)
            nodeConnector.resetAutoclose();
        });

        switch (query.messageType) {
          /*
            {
              messageType: "hello",
              uaid: "<a valid UAID>",
              interface: {
                ip: "<current device IP address>",
                port: "<TCP or UDP port in which the device is waiting for wake up notifications>"
                },
              mobilenetwork: {
                mcc: "<Mobile Country Code>",
                mnc: "<Mobile Network Code>"
              }
            }
           */
          case 'hello':
            if (!query.uaid || !token.verify(query.uaid)) {
              query.uaid = token.get();
              this.tokensGenerated++;
            }
            log.debug('WS:onWSMessage --> Theorical first connection for uaid=' + query.uaid);
            log.debug('WS:onWSMessage --> Accepted uaid=' + query.uaid);
            connection.uaid = query.uaid;

            // New UA registration
            log.debug('WS::onWSMessage --> HELLO - UA registration message');
            dataManager.registerNode(query, connection, function onNodeRegistered(error, data, uaid) {
              if (error) {
                connection.res({
                  errorcode: errorcodesWS.FAILED_REGISTERUA,
                  extradata: { messageType: 'hello' }
                });
                log.debug('WS::onWSMessage --> Failing registering UA');
                return;
              }
              dataManager.getNodeData(uaid, function(error, data) {
                if (error) {
                  log.debug('WS::onWSMessage --> Failing registering UA');
                  connection.res({
                    errorcode: errorcodesWS.FAILED_REGISTERUA,
                    extradata: { messageType: 'hello' }
                  });
                  return;
                }
                var WAtokensUrl = [];
                if (data.wa) {
                  WAtokensUrl = (data.wa).map(function(watoken) {
                    return helpers.getNotificationURL(watoken);
                  });
                }
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    messageType: 'hello',
                    uaid: uaid,
                    status: (data.dt.canBeWakeup ? statuscodes.UDPREGISTERED : statuscodes.REGISTERED),
                    channelIDs: WAtokensUrl
                  }
                });
                log.debug('WS::onWSMessage --> OK register UA');
              });
            });

            //onNodeRegistered.bind(connection));
            break;

            /**
              {
                messageType: "register",
                channelId: <channelId>
              }
             */
          case 'register':
            log.debug('WS::onWSMessage::register --> Application registration message');

            // Close the connection if the channelID is null
            var channelID = query.channelID;
            if (!channelID) {
              log.debug('WS::onWSMessage::register --> Null channelID');
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                extradata: {
                  messageType: 'register'
                }
              });
              //There must be a problem on the client, because channelID is the way to identify an app
              //Close in this case.
              connection.close();
            }

            // Register and store in database
            log.debug('WS::onWSMessage::register uaid: ' + connection.uaid);
            appToken = helpers.getAppToken(channelID, connection.uaid);
            dataManager.registerApplication(appToken, channelID, connection.uaid, null, function(error) {
              if (!error) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    messageType: 'register',
                    status: statuscodes.REGISTERED,
                    pushEndpoint: notifyURL,
                    'channelID': channelID
                  }
                });
                log.debug('WS::onWSMessage::register --> OK registering channelID');
              } else {
                connection.res({
                  errorcode: errorcodes.NOT_READY,
                  extradata: {
                    'channelID': channelID,
                    messageType: 'register'
                  }
                });
                log.debug('WS::onWSMessage::register --> Failing registering channelID');
              }
            });
            break;

            /**
              {
                messageType: "unregister",
                channelId: <channelId>
              }
             */
          case 'unregister':
            log.debug('WS::onWSMessage::unregister --> Application un-registration message');
            appToken = helpers.getAppToken(query.channelID, connection.uaid);
            dataManager.unregisterApplication(appToken, connection.uaid, function(error) {
              if (!error) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    channelID: query.channelID,
                    messageType: 'unregister',
                    status: statuscodes.UNREGISTERED
                  }
                });
                log.debug('WS::onWSMessage::unregister --> OK unregistering channelID');
              } else {
                connection.res({
                  errorcode: errorcodes.NOT_READY,
                  extradata: { messageType: 'unregister' }
                });
                log.debug('WS::onWSMessage::unregister --> Failing unregistering channelID');
              }
            });
            break;

          /**
            {
                messageType: “ack”,
                updates: [{"channelID": channelID, “version”: xxx}, ...]
            }
           */
          case 'ack':
            // TODO: ----
            if (query.messageId) {
              dataManager.removeMessage(query.messageId, connection.uaid);
            }
            break;

          /**
            {
              messageType: “clientState”,
              channelIDs: [{“channelID”: channelID, version: …}, …]
            }
           */
          case 'clientState':
            // TODO: Recovery method. Update channels registrations (add & remove)
            connection.res({
              errorcode: errorcodes.NO_ERROR,
              extradata: {
                messageType: 'clientState',
                status: statuscodes.OK
              }
            });
            break;

          /////////////////////////////////
          // TODO: Extended API
          /////////////////////////////////

          case 'registerExtended':
            log.debug('WS::onWSMessage::register --> Extended Application registration message');

            // Close the connection if the watoken is null
            var watoken = query.watoken;
            if (!watoken) {
              log.debug('WS::onWSMessage::register --> Null WAtoken');
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_WATOKEN,
                extradata: { messageType: 'register' }
              });
              //There must be a problem on the client, because WAtoken is the way to identify an app
              //Close in this case.
              connection.close();
            }

            var certUrl = query.certUrl;
            if(!certUrl && query.pbkbase64) {
              certUrl = query.pbkbase64;
            }
            if (!certUrl) {
              log.debug('WS::onWSMessage::registerWA --> Null certificate URL');
              //In this case, there is a problem, but there are no certificate.
              //We just reject the registration but we do not close the connection
              return connection.res({
                errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
                extradata: {
                  'watoken': watoken,
                  messageType: 'registerWA'
                }
              });
            }

            // Recover certificate
            var certUrl = url.parse(certUrl);
            if (!certUrl.href || !certUrl.protocol ) {
              log.debug('WS::onWSMessage::registerWA --> Non valid URL');
              //In this case, there is a problem, but there are no certificate.
              //We just reject the registration but we do not close the connection
              return connection.res({
                errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
                extradata: {
                  'watoken': watoken,
                  messageType: 'registerWA'
                }
              });
            }
            // Protocol to use: HTTP or HTTPS ?
            var protocolHandler = null;
            switch (certUrl.protocol) {
            case 'http:':
              protocolHandler = http;
              break;
            case 'https:':
              protocolHandler = https;
              break;
            default:
              protocolHandler = null;
            }
            if (!protocolHandler) {
              log.debug('WS::onWSMessage::registerWA --> Non valid URL (invalid protocol)');
              return connection.res({
                errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
                extradata: {
                  'watoken': watoken,
                  messageType: 'registerWA'
                }
              });
            }
            var req = protocolHandler.get(certUrl.href, function(res) {
                res.on('data', function(d) {
                  req.abort();
                  log.debug('Certificate received');
                  crypto.parseClientCertificate(d,function(err,cert) {
                    log.debug('Certificate processed');
                    if(err) {
                      log.debug('[ERROR] ' + err);
                      return connection.res({
                        errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
                        extradata: {
                          'watoken': watoken,
                          messageType: 'registerWA'
                        }
                      });
                    }
                    log.debug('[VALID CERTIFICATE] ' + cert.c);
                    log.debug('[VALID CERTIFICATE FINGERPRINT] ' + cert.f);

                    // Valid certificate, register and store in database
                    log.debug('WS::onWSMessage::registerWA uaid: ' + connection.uaid);
                      appToken = helpers.getAppToken(watoken, cert.f);
                      dataManager.registerApplication(appToken, watoken, connection.uaid, cert, function(error) {
                        if (!error) {
                          var notifyURL = helpers.getNotificationURL(appToken);
                          connection.res({
                            errorcode: errorcodes.NO_ERROR,
                            extradata: {
                              'watoken': watoken,
                              messageType: 'registerWA',
                              status: 'REGISTERED',
                              url: notifyURL
                            }
                          });
                          log.debug('WS::onWSMessage::registerWA --> OK registering WA');
                        } else {
                          connection.res({
                            errorcode: errorcodes.NOT_READY,
                            extradata: {
                              'watoken': watoken,
                              messageType: 'registerWA'
                            }
                          });
                          log.debug('WS::onWSMessage::registerWA --> Failing registering WA');
                        }
                      });
                  });
                });
            }).on('error', function(e) {
              log.debug('Error downloading client certificate ', e);
              return connection.res({
                errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
                extradata: {
                  'watoken': watoken,
                  messageType: 'registerWA'
                }
              });
            });
            break;

          default:
            log.debug('WS::onWSMessage::default --> messageType not recognized');
            connection.res({
              errorcode: errorcodesWS.MESSAGETYPE_NOT_RECOGNIZED
            });
            return connection.close();
        }
      } else if (message.type === 'binary') {
        // No binary data supported yet
        log.debug('WS::onWSMessage --> Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.res({
          errorcode: errorcodesWS.BINARY_MSG_NOT_SUPPORTED
        });
        return connection.close();
      }
    };

    var self = this;
    this.onWSClose = function(reasonCode, description) {
      self.wsConnections--;
      dataManager.unregisterNode(connection.uaid);
      log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected with uaid ' + connection.uaid);
    };

    /**
     * Verify origin in order to accept or reject connections
     */
    this.originIsAllowed = function(origin) {
      // TODO: put logic here to detect whether the specified origin is allowed. Issue #64
      return true;
    };

    ///////////////////////
    // Websocket creation
    ///////////////////////

    // Check limits
    if (this.wsConnections >= this.wsMaxConnections) {
      log.debug('WS::onWSRequest --> Connection unaccepted. To many open connections');
      return request.reject();
    }

    // Abuse controls
    if (!this.originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      log.debug('WS:: --> Connection from origin ' + request.origin + ' rejected.');
      return request.reject();
    }

    // Connection accepted
    var connection = request.accept('push-notification', request.origin);
    this.wsConnections++;
    log.debug('WS::onWSRequest --> Connection accepted.');
    connection.on('message', this.onWSMessage);
    connection.on('close', this.onWSClose);
  },

  ///////////////////////
  // Auxiliar methods
  ///////////////////////
  parseURL: function(url) {
    // TODO: Review logic of this method. Issue #65
    var urlparser = require('url');
    var data = {};
    data.parsedURL = urlparser.parse(url, true);
    var path = data.parsedURL.pathname.split('/');
    data.messageType = path[1];
    if (path.length > 2) {
      data.token = path[2];
    } else {
      data.token = data.parsedURL.query.token;
    }
    return data;
  },

  stop: function() {
    if (cluster.isMaster) {
      setTimeout(function() {
        process.exit(0);
      }, 10000);
      return;
    }
    log.info('WS::stop --> Closing WS server');
    //Server not ready
    this.ready = false;
    //Closing connection with msgBroker
    msgBroker.close();
    //Closing connections from the server
    this.server.close();
  }
};

// Exports
exports.server = server;
