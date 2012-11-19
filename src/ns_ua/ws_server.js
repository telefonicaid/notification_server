/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js"),
    WebSocketServer = require('websocket').server,
    https = require('https'),
    fs = require('fs'),
    crypto = require("../common/cryptography.js"),
    dataManager = require("./datamanager.js"),
    Connectors = require("./connectors/connector_base.js").getConnectorFactory(),
    token = require("../common/token.js"),
    helpers = require("../common/helpers.js"),
    msgBroker = require("../common/msgbroker.js"),
    config = require("../config.js").NS_UA_WS,
    consts = require("../config.js").consts,
    errorcodes = require("../common/constants").errorcodes.GENERAL,
    errorcodesWS = require("../common/constants").errorcodes.UAWS;

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewMessage(message) {
  log.debug('WS::Queue::onNewMessage --> New message received: ' + message);
  var json = {};
  try {
    json = JSON.parse(message);
  } catch(e) {
    log.debug('WS::Queue::onNewMessage --> Not a valid JSON');
    return;
  }
  // If we don't have enough data, return
  if (!json.uatoken ||
      !json.payload ||
      !json.payload.payload) {
    return log.error('WS::queue::onNewMessage --> Not enough data!');
  }
  log.debug("WS::Queue::onNewMessage --> Notifying node:", json.uatoken);
  log.notify("Message with id " + json.messageId + " sent to " + json.uatoken);
  dataManager.getNode(json.uatoken, function(nodeConnector) {
    if(nodeConnector) {
      log.debug("WS::Queue::onNewMessage --> Sending messages:", json.payload.payload);
      nodeConnector.notify(new Array(json.payload.payload));
    } else {
      log.debug("WS::Queue::onNewMessage --> No node found");
    }
  });
}
////////////////////////////////////////////////////////////////////////////////

function server(ip, port) {
  this.ip = ip;
  this.port = port;
  this.ready = false;
  this.tokensGenerated = 0;
  this.wsConnections = 0;
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////
  init: function() {
    // Create a new HTTP Server
    var options = {
      key: fs.readFileSync(consts.key),
      cert: fs.readFileSync(consts.cert)
    };
    this.server = https.createServer(options, this.onHTTPMessage.bind(this));
    this.server.listen(this.port, this.ip);
    log.info('WS::server::init --> HTTP push UA_WS server running on ' + this.ip + ":" + this.port);

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
    setTimeout(function() {
      msgBroker.init();
    }, 10);

    //Check if we are alive
    setTimeout(function() {
      if (!self.ready)
        log.critical('30 seconds has passed and we are not ready, closing');
    }, 30*1000); //Wait 30 seconds

  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    response.res = function responseHTTP(errorCode, html) {
      log.debug('NS_UA_WS::responseHTTP: ', errorCode);
      this.statusCode = errorCode[0];
      this.setHeader("access-control-allow-origin", "*");
      if(html) {
        this.setHeader("Content-Type", "text/html");
        this.write(html);
      } else {
        if(consts.PREPRODUCTION_MODE) {
          this.setHeader("Content-Type", "text/plain");
          if(this.statusCode == 200) {
            this.write('{"status":"ACCEPTED"}');
          } else {
            this.write('{"status":"ERROR", "reason":"'+errorCode[1]+'"}');
          }
        }
      }
      return this.end();
    }

    var text = null;
    if (!this.ready) {
      log.info('WS:onHTTPMessage --> Request received but not ready yet');
      return response.res(errorcodes.NOT_READY);
    } else {
      log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
      var url = this.parseURL(request.url);

      log.debug("WS::onHTTPMessage --> Parsed URL:", url);
      switch (url.messageType) {
      case 'token':
        text = token.get();
        this.tokensGenerated++;
        return response.res(errorcodes.NO_ERROR, text);
        break;

      case 'about':
        if(consts.PREPRODUCTION_MODE) {
          try {
            var fs = require("fs");
            text = "Push Notification Server (User Agent Frontend)<br />";
            text += "&copy; Telef&oacute;nica Digital, 2012<br />";
            text += "Version: " + fs.readFileSync("version.info") + "<br /><br />";
            text += "<a href=\"https://github.com/telefonicaid/notification_server\">Collaborate !</a><br />";
            text += "<ul>";
            text += "<li>Number of tokens generated: " + this.tokensGenerated + "</li>";
            text += "<li>Number of opened connections to WS: " + this.wsConnections + "</li>";
            text += "</ul>";
          } catch(e) {
            text = "No version.info file";
          }
          return response.res(errorcodes.NO_ERROR, text);
        } else {
          return response.res(errorcodes.NOT_ALLOWED_ON_PRODUCTION_SYSTEM);
        }
        break;

      default:
        log.debug("WS::onHTTPMessage --> messageType not recognized");
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
        if(payload.extradata) {
          res = payload.extradata;
        }
        res.statuscode = payload.errorcode[0];
        if(payload.errorcode[0] > 299) {    // Out of the 2xx series
          if(!res.status) {
            res.status = "ERROR";
          }
          res.reason = payload.errorcode[1];
        } else {
          if(!res.status) {
            res.status = "OK";
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
        } catch(e) {
          log.debug("WS::onWSMessage --> Data received is not a valid JSON package");
          connection.res({
            errorcode: errorcodesWS.NOT_VALID_JSON_PACKAGE
          });
          return connection.close();
        }

        switch(query.messageType) {
          case "registerUA":
            log.debug("WS::onWSMessage --> UA registration message");
            // Token verification
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage --> Token not valid (Checksum failed)");
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_UATOKEN,
                extradata: { messageType: "registerUA" }
              });
              return connection.close();
            }
            // New UA registration
            Connectors.getConnector(query.data, connection, function(err,c) {
              if(err) {
                  connection.res({
                    errorcode: errorcodesWS.ERROR_GETTING_CONNECTOR,
                    extradata: { messageType: "registerUA" }
                  });
                  return log.error("WS::onWSMessage --> Error getting connection object");
              }

              dataManager.registerNode(
                query.data.uatoken,
                c,
                function(ok) {
                  if (ok) {
                    connection.res({
                      errorcode: errorcodes.NO_ERROR,
                      extradata: {
                        messageType: "registerUA",
                        status: "REGISTERED"
                      }
                    });
                    log.debug("WS::onWSMessage --> OK register UA");
                  } else {
                    connection.res({
                      errorcode: errorcodesWS.FAILED_REGISTERUA,
                      extradata: { messageType: "registerUA" }
                    });
                    log.debug("WS::onWSMessage --> Failing registering UA");
                  }
                }
              );
            }.bind(this));
            break;

          case "registerWA":
            log.debug("WS::onWSMessage::registerWA --> Application registration message");
            // Close the connection if the
            var watoken = query.data.watoken;
            if (!watoken) {
              log.debug("WS::onWSMessage::registerWA --> Null WAtoken");
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_WATOKEN,
                extradata: { messageType: "registerWA" }
              });
              //There must be a problem on the client, because WAtoken is the way to identify an app
              //Close in this case.
              connection.close();
            }

            var pbkbase64 = query.data.pbkbase64;
            if (!pbkbase64) {
              log.debug("WS::onWSMessage::registerWA --> Null pbk");
              //In this case, there is a problem, but there are no PbK. We just reject
              //the registration but we do not close the connection
              return connection.res({
                errorcode: errorcodesWS.NOT_VALID_PBK,
                extradata: {
                  'watoken': watoken,
                  messageType: "registerWA"
                }
              });
            }

            // Check if we have a token (in the connection or in the message)
            var uatoken = dataManager.getUAToken(connection) || query.data.uatoken;
            if(!uatoken) {
              log.debug("No UAToken found for this connection");
              connection.res({
                errorcode: errorcodesWS.UATOKEN_NOT_FOUND,
                extradata: {
                  'watoken': watoken,
                  messageType: "registerWA"
                }
              });
              return connection.close();
            }

            // Check if the token is correct
            if(!token.verify(uatoken)) {
              log.debug("WS::onWSMessage --> Token not valid (Checksum failed)");
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_UATOKEN,
                extradata: {
                  'watoken': watoken,
                  messageType: "registerWA"
                }
              });
              return connection.close();
            }

            log.debug("WS::onWSMessage::registerWA UAToken: " + uatoken);
            appToken = helpers.getAppToken(watoken, pbkbase64);
            dataManager.registerApplication(appToken, uatoken, pbkbase64, function(ok) {
              if (ok) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    'watoken': watoken,
                    messageType: "registerWA",
                    status: "REGISTERED",
                    url: notifyURL
                  }
                });
                log.debug("WS::onWSMessage::registerWA --> OK registering WA");
              } else {
                connection.res({
                  errorcode: errorcodes.NOT_READY,
                  extradata: {
                    'watoken': watoken,
                    messageType: "registerWA"
                  }
                });
                log.debug("WS::onWSMessage::registerWA --> Failing registering WA");
              }
            });
            break;

          case "unregisterWA":
            log.debug("WS::onWSMessage::unregisterWA --> Application un-registration message");
            if(!dataManager.getUAToken(connection)) {
              log.debug("No UAToken found for this connection !");
              connection.res({
                errorcode: errorcodes.UATOKEN_NOTFOUND,
                extradata: {
                  'watoken': watoken,
                  messageType: "unregisterWA"
                }
              });
              connection.close();
              break;
            }

            appToken = helpers.getAppToken(query.data.watoken, query.data.pbkbase64);
            dataManager.unregisterApplication(appToken, dataManager.getUAToken(connection), query.data.pbkbase64, function(ok) {
              if (ok) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    url: notifyURL,
                    messageType: "unregisterWA",
                    status: "UNREGISTERED"
                  }
                });
                log.debug("WS::onWSMessage::unregisterWA --> OK unregistering WA");
              } else {
                connection.res({
                  errorcode: errorcodes.NOT_READY,
                  extradata: { messageType: "unregisterWA" }
                });
                log.debug("WS::onWSMessage::unregisterWA --> Failing unregistering WA");
              }
            });
            break;

          case "getAllMessages":
            if(dataManager.getUAToken(connection)) {
              log.debug('WS::onWSMessage::getAllMessages --> Not allowed on WS connections');
                connection.res({
                  errorcode: errorcodesWS.COMMAND_NOT_ALLOWED,
                  extradata: { messageType: "getAllMessages" }
                });
              return;
            }
            if(!query.data.uatoken) {
              log.debug("WS::onWSMessage::getAllMessages --> No UAtoken sent");
              connection.res({
                errorcode: errorcodesWS.UATOKEN_NOT_SENT,
                extradata: { messageType: "getAllMessages" }
              });
              return connection.close();
            }
            log.debug("WS::onWSMessage::getAllMessages --> Recovering messages for " + query.data.uatoken);
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage::getAllMessages --> Token not valid (Checksum failed)");
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_UATOKEN,
                extradata: { messageType: "getAllMessages" }
              });
              return connection.close();
            } else {
              dataManager.getAllMessages(query.data.uatoken, function(messages, close) {
                connection.sendUTF(JSON.stringify(messages));
                if (close) connection.close();
                return;
              });
            }
            break;

          case "getRegisteredWA":
            log.debug("WS::onWSMessage::getRegisteredWA --> Recovering list of registered WA");

            if(!dataManager.getUAToken(connection)) {
              log.debug("No UAToken found for this connection !");
              connection.res({
                errorcode: errorcodes.UATOKEN_NOTFOUND,
                extradata: {
                  'WATokens': [],
                  messageType: "getRegisteredWA"
                }
              });
              break;
            }
            dataManager.getApplicationsForUA(dataManager.getUAToken(connection),
              function (d) {
                log.debug("",d);
                var URLs = [];
                if(d) {
                  d.forEach(function(appToken) {
                    URLs.push(helpers.getNotificationURL(appToken._id));
                  });
                }
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    'WATokens': URLs,
                    messageType: "getRegisteredWA"
                  }
                });
              });
            break;

          case "ack":
            if(query.messageId) {
              dataManager.removeMessage(query.messageId);
            }
            break;

          default:
            log.debug("WS::onWSMessage::default --> messageType not recognized");
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
      log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected.');
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
    if (!this.originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      log.debug('WS:: --> Connection from origin ' + request.origin + ' rejected.');
      return request.reject();
    }

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
    data.parsedURL = urlparser.parse(url,true);
    var path = data.parsedURL.pathname.split("/");
    data.messageType = path[1];
    if(path.length > 2) {
      data.token = path[2];
    } else {
      data.token = data.parsedURL.query.token;
    }
    return data;
  },

  stop: function(callback) {
    log.info("WS::stop --> Closing WS server");
    //Server not ready
    this.ready = false;
    //Closing connection with msgBroker
    msgBroker.close();
    //Closing connections from the server
    this.server.close(function() {
      //Calling the callback
      callback(null);
    });
  }
};

// Exports
exports.server = server;
