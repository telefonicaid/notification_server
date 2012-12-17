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
    numCPUs = require('os').cpus().length,
    cluster = require('cluster'),
    crypto = require('../common/cryptography.js'),
    dataManager = require('./datamanager.js'),
    token = require('../common/token.js'),
    helpers = require('../common/helpers.js'),
    msgBroker = require('../common/msgbroker.js'),
    config = require('../config.js').NS_UA_WS,
    consts = require('../config.js').consts,
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesWS = require('../common/constants').errorcodes.UAWS;

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewMessage(message) {
  log.debug('WS::Queue::onNewMessage --> New message received: ' + message);
  var json = {};
  try {
    json = JSON.parse(message);
  } catch (e) {
    log.debug('WS::Queue::onNewMessage --> Not a valid JSON');
    return;
  }
  // If we don't have enough data, return
  if (!json.uatoken ||
      !json.messageId ||
      !json.payload) {
    return log.error('WS::queue::onNewMessage --> Not enough data!');
  }
  log.debug('WS::Queue::onNewMessage --> Notifying node:', json.uatoken);
  log.notify('Message with id ' + json.messageId + ' sent to ' + json.uatoken);
  dataManager.getNode(json.uatoken, function(nodeConnector) {
    if (nodeConnector) {
      var notification = json.payload;

      //Send the URL not the appToken
      notification.url = helpers.getNotificationURL(notification.appToken);
      delete notification.appToken;
      log.debug('WS::Queue::onNewMessage --> Sending messages:', notification);
      nodeConnector.notify(new Array(notification));
    } else {
      log.debug('WS::Queue::onNewMessage --> No node found');
    }
  });
}

function onNodeRegistered(error, data, uatoken) {
  var connection = this;
  if (error) {
    connection.res({
      errorcode: errorcodesWS.FAILED_REGISTERUA,
      extradata: { messageType: 'registerUA' }
    });
    log.debug('WS::onWSMessage --> Failing registering UA');
    return;
  }
  dataManager.getNodeData(uatoken, function(error, data) {
    if (error) {
      log.debug('WS::onWSMessage --> Failing registering UA');
      connection.res({
        errorcode: errorcodesWS.FAILED_REGISTERUA,
        extradata: { messageType: 'registerUA' }
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
        messageType: 'registerUA',
        status: 'REGISTERED',
        pushMode: data.dt.protocol,
        WATokens: WAtokensUrl,
        messages: data.ms || []
      }
    });
    log.debug('WS::onWSMessage --> OK register UA');
  });
}

////////////////////////////////////////////////////////////////////////////////

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
      for (var i = 0; i < numCPUs; i++) {
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
        msgBroker.subscribe(process.serverId, args, function(msg) {onNewMessage(msg);});
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
        case 'token':
          text = token.get();
          this.tokensGenerated++;
          return response.res(errorcodes.NO_ERROR, text);
          break;

        case 'about':
          if (consts.PREPRODUCTION_MODE) {
            try {
              var fs = require('fs');
              text = 'Push Notification Server (User Agent Frontend)<br />';
              text += '&copy; Telef&oacute;nica Digital, 2012<br />';
              text += 'Version: ' + fs.readFileSync('version.info') + '<br /><br />';
              text += '<a href=\"https://github.com/telefonicaid/notification_server\">Collaborate !</a><br />';
              text += '<ul>';
              text += '<li>Number of tokens generated: ' + this.tokensGenerated + '</li>';
              text += '<li>Number of opened connections to WS: ' + this.wsConnections + '</li>';
              text += '<li>Maximum Number of open connections to WS: ' + this.wsMaxConnections + '</li>';
              text += '</ul>';
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

        //Check for uatoken in the connection
        if (!connection.uatoken && query.messageType === 'registerUA') {
          log.debug('WS:onWSMessage --> Theorical first connection for uatoken=' + query.data.uatoken);
          if (!token.verify(query.data.uatoken)) {
            log.debug('WS::onWSMessage --> Token not valid (Checksum failed)');
            connection.res({
              errorcode: errorcodesWS.NOT_VALID_UATOKEN,
              extradata: { messageType: 'registerUA' }
            });
            return connection.close();
          }
          log.debug('WS:onWSMessage --> Accepted uatoken=' + query.data.uatoken);
          connection.uatoken = query.data.uatoken;
        } else if (!connection.uatoken) {
          log.debug('WS:onWSMessage --> No UAToken for this connection');
          connection.res({
            errorcode: errorcodesWS.UATOKEN_NOT_FOUND,
            extradata: { messageType: query.messageType }
          });
          connection.close();
          return;
        }

        switch (query.messageType) {
          case 'registerUA':
            log.debug('WS::onWSMessage --> UA registration message');
            // New UA registration
            dataManager.registerNode(query.data, connection, onNodeRegistered.bind(connection));
            break;

          case 'unregisterUA':
            log.debug('WS::onWSMessage::unregisterUA -> UA unregistration message');
            dataManager.unregisterNode(connection.uatoken);
            break;

          case 'registerWA':
            log.debug('WS::onWSMessage::registerWA --> Application registration message');

            // Close the connection if the
            var watoken = query.data.watoken;
            if (!watoken) {
              log.debug('WS::onWSMessage::registerWA --> Null WAtoken');
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_WATOKEN,
                extradata: { messageType: 'registerWA' }
              });
              //There must be a problem on the client, because WAtoken is the way to identify an app
              //Close in this case.
              connection.close();
            }

            var pbkbase64 = query.data.pbkbase64;
            if (!pbkbase64) {
              log.debug('WS::onWSMessage::registerWA --> Null pbk');
              //In this case, there is a problem, but there are no PbK. We just reject
              //the registration but we do not close the connection
              return connection.res({
                errorcode: errorcodesWS.NOT_VALID_PBK,
                extradata: {
                  'watoken': watoken,
                  messageType: 'registerWA'
                }
              });
            }

            log.debug('WS::onWSMessage::registerWA UAToken: ' + connection.uatoken);
            appToken = helpers.getAppToken(watoken, pbkbase64);
            dataManager.registerApplication(appToken, watoken, connection.uatoken, pbkbase64, function(error) {
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
            break;

          case 'unregisterWA':
            log.debug('WS::onWSMessage::unregisterWA --> Application un-registration message');
            appToken = helpers.getAppToken(query.data.watoken, query.data.pbkbase64);
            dataManager.unregisterApplication(appToken, connection.uatoken, query.data.pbkbase64, function(error) {
              if (!error) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    url: notifyURL,
                    messageType: 'unregisterWA',
                    status: 'UNREGISTERED'
                  }
                });
                log.debug('WS::onWSMessage::unregisterWA --> OK unregistering WA');
              } else {
                connection.res({
                  errorcode: errorcodes.NOT_READY,
                  extradata: { messageType: 'unregisterWA' }
                });
                log.debug('WS::onWSMessage::unregisterWA --> Failing unregistering WA');
              }
            });
            break;

          case 'getRegisteredWA':
            log.debug('WS::onWSMessage::getRegisteredWA --> Recovering list of registered WA');
            dataManager.getApplicationsForUA(connection.uatoken,
              function(err, d) {
                if (err) {
                  log.error('WS::onWSMessage::getRegisteredWA --> Internal error: ' + err);
                  connection.res({
                    errorcode: errorcodes.UATOKEN_NOTFOUND,
                    extradata: {
                      'WATokens': [],
                      messageType: 'getRegisteredWA'
                    }
                  });
                  return;
                }
                var was = d[0].wa || [];
                log.debug('WS::onWSMessage::getRegisteredWA --> ' + was);
                var URLs = [];
                if (Array.isArray(was)) {
                  was.forEach(function(appToken) {
                    URLs.push(helpers.getNotificationURL(appToken));
                  });
                  connection.res({
                    errorcode: errorcodes.NO_ERROR,
                    extradata: {
                      'WATokens': URLs,
                      messageType: 'getRegisteredWA'
                    }
                  });
                }
              });
            break;

          case 'ack':
            if (query.messageId) {
              dataManager.removeMessage(query.messageId, connection.uatoken);
            }
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
      dataManager.unregisterNode(connection.uatoken);
      log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected with uatoken ' + connection.uatoken);
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
