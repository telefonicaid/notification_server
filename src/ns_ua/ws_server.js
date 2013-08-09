/* jshint node: true */
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
    https = require('https'),
    maintenance = require('../common/maintenance.js');

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
          log.error(log.messages.ERROR_WORKERERROR, {
            "pid": worker.process.pid,
            "code": code
          });
        } else {
          log.info('worker ' + worker.process.pid + ' exit');
        }
      });
    } else {
      // Create a new HTTP(S) Server
      if (this.ssl) {
        var options = {
          ca: helpers.getCaChannel(),
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
        maxReceivedMessageSize: config.websocket_params.MAX_MESSAGE_SIZE,
        assembleFragments: true,
        autoAcceptConnections: false    // false => Use verify originIsAllowed method
      });
      this.wsServer.on('request', this.onWSRequest.bind(this));

      // Subscribe to my own Queue
      var self = this;
      msgBroker.once('brokerconnected', function() {
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
              !json.payload) {
            return log.error(log.messages.ERROR_WSNODATA);
          }
          log.debug('WS::Queue::onNewMessage --> Notifying node:', json.uaid);
          log.notify(log.messages.NOTIFY_MSGSENTTOUA, {
            messageId: json.messageId,
            uaid: json.uaid
          });
          dataManager.getNodeConnector(json.uaid, function(nodeConnector) {
            if (nodeConnector) {
              var notification = json.payload;

              // Not send the appToken or other attributes
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
              delete notification.app;
              delete notification.new;
              if (notification.ch) {
                notification.channelID = notification.ch;
                delete notification.ch;
              }
              if (notification.vs) {
                notification.version = notification.vs;
                delete notification.vs;
              }
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
      msgBroker.once('brokerdisconnected', function() {
        log.critical(log.messages.CRITICAL_MBDISCONNECTED, {
          "class": 'ns_ws',
          "method": 'init'
        });
      });

      //Connect to msgBroker
      process.nextTick(function() {
        msgBroker.init();
      });

      //Check if we are alive
      this.readyTimeout = setTimeout(function() {
        if (!self.ready)
          log.critical(log.messages.CRITICAL_NOTREADY);
      }, 30 * 1000); //Wait 30 seconds
    }

    // Check ulimit
    helpers.getMaxFileDescriptors(function(error,ulimit) {
      if (error) {
        return log.error(log.messages.ERROR_ULIMITERROR, {
          "error": error
        });
      }
      log.debug('ulimit = ' + ulimit);
      var limit = ulimit - 200;
      if (limit < 10) {
        log.critical(log.messages.CRITICAL_WSERRORULIMIT);
      }
      this.wsMaxConnections = limit;
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

        case 'status':
          // Return status mode to be used by load-balancers
          response.setHeader('Content-Type', 'text/html');
          if (maintenance.getStatus()) {
            response.statusCode = 503;
            response.write('Under Maintenance');
          } else {
            response.statusCode = 200;
            response.write('OK');
          }
          return response.end();
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
    var self = this;

    ///////////////////////
    // WS Callbacks
    ///////////////////////
    this.onWSMessage = function(message) {
      connection.res = function responseWS(payload) {
        log.debug('WS::responseWS:', payload);
        var res = {};
        if (payload && payload.extradata) {
          res = payload.extradata;
        }
        if (payload && payload.errorcode[0] > 299) {    // Out of the 2xx series
          if (!res.status) {
            res.status = payload.errorcode[0];
          }
          res.reason = payload.errorcode[1];
        }
        connection.sendUTF(JSON.stringify(res));
      };

      // Restart autoclosing timeout
      if (connection.uaid) {
        dataManager.getNodeConnector(connection.uaid, function(nodeConnector) {
          if (nodeConnector)
            nodeConnector.resetAutoclose();
        });
      }

      if (message.type === 'utf8') {
        log.debug('WS::onWSMessage --> Received Message: ' + message.utf8Data);
        var query = {};
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

        // If we have a uaid for this connection, ignore this message
        if (connection.uaid && query.messageType === 'hello') {
          log.debug('WS:onWSMessage --> New hello message on a hello\'ed ' +
                   'connection is discarded');
          return;
        }

        switch (query.messageType) {
          case undefined:
            log.debug('WS::onWSMessage --> PING package');
            process.nextTick(function() {
              self.getPendingMessages(connection.uaid, function(channelsUpdate) {
                if (!channelsUpdate) {
                  return connection.sendUTF('{}');
                }
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    messageType: 'notification',
                    updates: channelsUpdate
                  }
                });
              });
            });
            break;

          /*
            {
              messageType: "hello",
              uaid: "<a valid UAID>",
              channelIDs: [channelID1, channelID2, ...],
              wakeup_hostport: {
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
              query.channelIDs = null;
              self.tokensGenerated++;
            }
            log.debug('WS:onWSMessage --> Accepted uaid=' + query.uaid);
            connection.uaid = query.uaid;

            //KPI: 0x2000
            log.notify(log.messages.NOTIFY_HELLO, {
              uaid: connection.uaid,
              mcc: (query.mobilenetwork && query.mobilenetwork.mcc) || 0,
              mnc: (query.mobilenetwork && query.mobilenetwork.mnc) || 0
            });

            // New UA registration
            log.debug('WS::onWSMessage --> HELLO - UA registration message');
            //query parameters are validated while getting the connector in
            // connectors/connector.js
            dataManager.registerNode(query, connection, function onNodeRegistered(error, res, data) {
              if (error) {
                connection.res({
                  errorcode: errorcodesWS.FAILED_REGISTERUA,
                  extradata: { messageType: 'hello' }
                });
                log.debug('WS::onWSMessage --> Failing registering UA');
                return connection.close();
              }
              connection.res({
                errorcode: errorcodes.NO_ERROR,
                extradata: {
                  messageType: 'hello',
                  uaid: query.uaid,
                  status: (data.canBeWakeup ? statuscodes.UDPREGISTERED : statuscodes.REGISTERED)
                }
              });

              // If uaid do not have any channelIDs (first connection), we do not launch this processes.
              if (query.channelIDs && Array.isArray(query.channelIDs)) {
                //Start recovery protocol
                process.nextTick(function() {
                  self.recoveryChannels(connection.uaid, query.channelIDs);
                });

                process.nextTick(function() {
                  self.getPendingMessages(connection.uaid, function(channelsUpdate) {
                    if (!channelsUpdate) {
                      return;
                    }
                    log.debug("CHANNELS: ",channelsUpdate);
                    connection.res({
                      errorcode: errorcodes.NO_ERROR,
                      extradata: {
                        messageType: 'notification',
                        updates: channelsUpdate
                      }
                    });
                  });
                });
              }
              log.debug('WS::onWSMessage --> OK register UA');
            });
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
            if (!channelID || typeof(channelID) !== 'string') {
              log.debug('WS::onWSMessage::register --> Null channelID');
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                extradata: {
                  messageType: 'register'
                }
              });
              //There must be a problem on the client, because channelID is the way to identify an app
              //Close in this case.
              return connection.close();
            }

            // Register and store in database
            log.debug('WS::onWSMessage::register uaid: ' + connection.uaid);
            var appToken = helpers.getAppToken(channelID, connection.uaid);

            //KPI: 0x2001
            log.notify(log.messages.NOTIFY_REGISTER, {
              uaid: connection.uaid,
              channelID: channelID,
              appToken: appToken
            });

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
            // Close the connection if the channelID is null
            channelID = query.channelID;

            log.debug('WS::onWSMessage::unregister --> Application un-registration message for ' + channelID);
            if (!channelID || typeof(channelID) !== 'string') {
              log.debug('WS::onWSMessage::unregister --> Null channelID');
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                extradata: {
                  messageType: 'unregister'
                }
              });
              //There must be a problem on the client, because channelID is the way to identify an app
              //Close in this case.
              return connection.close();
            }

            appToken = helpers.getAppToken(query.channelID, connection.uaid);

            //KPI: 0x2002
            log.notify(log.messages.NOTIFY_UNREGISTER, {
              uaid: connection.uaid,
              channelID: channelID,
              appToken: appToken
            });

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
                if (error == -1) {
                  connection.res({
                    errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                    extradata: { messageType: 'unregister' }
                  });
                } else {
                  connection.res({
                    errorcode: errorcodes.NOT_READY,
                    extradata: { messageType: 'unregister' }
                  });
                }
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
            if (!Array.isArray(query.updates)) {
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                extradata: { messageType: 'ack' }
              });
              connection.close();
              return;
            }

            query.updates.forEach(function(el) {
              if (!el.channelID || typeof el.channelID !== 'string' ||
                  !helpers.isVersion(el.version)) {
                connection.res({
                  errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                  extradata: { messageType: 'ack',
                               channelID: el.channelID,
                               version: el.version}
                });
                return;
              }

              log.notify(log.messages.NOTIFY_ACK, {
                uaid: connection.uaid,
                channelID: el.channelID,
                appToken: helpers.getAppToken(el.channelID, connection.uaid),
                version: el.version
              });

              dataManager.ackMessage(connection.uaid, el.channelID, el.version);
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
    try {
      var connection = request.accept('push-notification', request.origin);
      this.wsConnections++;
      log.debug('WS::onWSRequest --> Connection accepted.');
      connection.on('message', this.onWSMessage);
      connection.on('close', this.onWSClose);
    } catch(e) {
      log.debug('WS::onWSRequest --> Connection from origin ' + request.origin + 'rejected. Bad WebSocket sub-protocol.');
      return request.reject();
    }
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

  getPendingMessages: function(uaid, callback) {
    callback = helpers.checkCallback(callback);
    log.debug('WS::onWSMessage::getPendingMessages --> Sending pending notifications');
    dataManager.getNodeData(uaid, function(err, data) {
      if (err) {
        log.error(log.messages.ERROR_WSERRORGETTINGNODE);
        return callback(null);
      }
      // In this case, there are no channels for this
      if (!data || !data.ch || !Array.isArray(data.ch)) {
        log.debug(log.messages.ERROR_WSNOCHANNELS);
        return callback(null);
      }
      var channelsUpdate = [];
      data.ch.forEach(function(channel) {
        if (helpers.isVersion(channel.vs) && channel.new) {
          channelsUpdate.push({
            channelID: channel.ch,
            version: channel.vs
          });
        }
      });
      if (channelsUpdate.length > 0) {
        return callback(channelsUpdate);
      }

      //No channelsUpdate (no new)
      return callback(null);
    });
  },

  recoveryChannels: function(uaid, channelIDs) {
    log.debug('WS::onWSMessage::recoveryChannels --> ' +
              'Recovery channels process for UAID=' + uaid +
              ', channelsIDs=', channelIDs);
    dataManager.getApplicationsForUA(uaid, function(error, channels) {
      log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                ', recoveredchannels=' + JSON.stringify(channels));
      if (error) {
        return;
      }
      channels.forEach(function(ch) {
        //Already registered
        log.debug('WS::onWSMessage::recoveryChannels --> Checking server channel=' +
                  JSON.stringify(ch.ch));
        if (channelIDs.indexOf(ch.ch) > -1) {
          log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                    ', had previously registered=' + ch.ch);
        } else {
          // Need to unregister (not in send)
          log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                    ', to unregister=' + ch.ch);
          var appToken = helpers.getAppToken(ch.ch, uaid);
          dataManager.unregisterApplication(appToken, uaid);
          return;
        }

        // Splicing the Array, so we end up with the old array with
        // just new registrations
        var index = channelIDs.indexOf(ch.ch);
        if (index > -1) {
          channelIDs.splice(index, 1);
        }
      });
      //Register the spliced channelIDs
      log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                ', to register unregistered=' + channelIDs);
      channelIDs.forEach(function(ch) {
        log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                  ', to register=' + ch);
        var appToken = helpers.getAppToken(ch, uaid);
        dataManager.registerApplication(appToken, ch, uaid, null, function(error) {
          if (error) {
            log.debug('WS::onWSMessage::recoveryChannels --> Failing registering channelID');
            return;
          }
          var notifyURL = helpers.getNotificationURL(appToken);
          log.debug('WS::onWSMessage::recoveryChannels --> OK registering channelID: ' + notifyURL);
        });
      });
    });
  },

  stop: function() {
    if (cluster.isMaster) {
      setTimeout(function() {
        process.exit(0);
      }, 10000);
      return;
    }
    log.info('WS::stop --> Closing WS server');
    clearTimeout(this.readyTimeout);
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
