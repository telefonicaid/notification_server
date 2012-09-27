/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
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
    consts = require("../config.js").consts;

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
  log.debug("WS::Queue::onNewMessage --> Notifying node: " + JSON.stringify(json.uatoken));
  dataManager.getNode(json.uatoken, function(nodeConnector) {
    if(nodeConnector) {
      log.debug("WS::Queue::onNewMessage --> Sending messages: " + JSON.stringify(json.payload.payload));
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
  self = this;
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
      if (!this.ready)
        log.critical('30 seconds has passed and we are not ready, closing');
    }, 30*1000); //Wait 30 seconds

  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    var status = null;
    var text = null;
    if (!this.ready) {
      log.info('WS:onHTTPMessage --> Request received but not ready yet');
      text = '{"status": "ERROR", "reason": "Server not ready. Try again."}';
      status = 404;
    } else {
      log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
      var url = this.parseURL(request.url);

      log.debug("WS::onHTTPMessage --> Parsed URL: " + JSON.stringify(url));
      switch (url.messageType) {
      case 'token':
        text = token.get();
        response.setHeader("Content-Type", "text/plain");
        status = 200;
        this.tokensGenerated++;
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
            response.setHeader("Content-Type", "text/html");
          } catch(e) {
            text = "No version.info file";
          }
          status = 200;
        } else {
          status = 404;
          text = '{"status": "ERROR", "reason": "Not allowed on production system"}';
        }
        break;

      default:
        log.debug("WS::onHTTPMessage --> messageType not recognized");
        text = '{"status": "ERROR", "reason": "messageType not recognized for this HTTP API"}';
        response.setHeader("Content-Type", "text/plain");
        status = 404;
      }
    }

    // Close connection
    response.statusCode = status;
    response.setHeader("access-control-allow-origin", "*");
    response.write(text);
    return response.end();
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
      if (message.type === 'utf8') {
        log.debug('WS::onWSMessage --> Received Message: ' + message.utf8Data);
        var query = null;
        try {
          query = JSON.parse(message.utf8Data);
        } catch(e) {
          log.debug("WS::onWSMessage --> Data received is not a valid JSON package");
          connection.sendUTF('{ "status": "ERROR",' +
                               '"reason": "Data received is not a valid JSON package",' +
                               '"messageType":"registerUA" }');
          return connection.close();
        }

        switch(query.messageType) {
          case "registerUA":
            log.debug("WS::onWSMessage --> UA registration message");
            // Token verification
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage --> Token not valid (Checksum failed)");
              connection.sendUTF('{ "status": "ERROR",' +
                                   '"reason": "Token not valid for this server",' +
                                   '"messageType": "registerUA" }');
              return connection.close();
            }
            // New UA registration
            Connectors.getConnector(query.data, connection, function(err,c) {
              if(err) {
                  connection.sendUTF('{"status":"ERROR",' +
                                      '"reason": "Try again later",' +
                                      '"messageType":"registerUA"}');
                  return log.error("WS::onWSMessage --> Error getting connection object");
              }

              dataManager.registerNode(
                query.data.uatoken,
                c,
                function(ok) {
                  if (ok) {
                    connection.sendUTF('{"status":"REGISTERED", "messageType": "registerUA"}');
                    log.debug("WS::onWSMessage --> OK register UA");
                  } else {
                    connection.sendUTF('{"status":"ERROR",' +
                                        '"reason": "Try again later",' +
                                        '"messageType":"registerUA"}');
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
              connection.sendUTF('{"status": "ERROR",' +
                                  '"reason": "Not valid WAtoken sent",' +
                                  '"messageType" : "registerWA"}"');
              //There must be a problem on the client, because WAtoken is the way to identify an app
              //Close in this case.
              connection.close();
            }

            var pbkbase64 = query.data.pbkbase64;
            //TODO: check if the pbk sent is valid. Issue 81
            if (!pbkbase64) {
              log.debug("WS::onWSMessage::registerWA --> Null pbk");
              //In this case, there is a problem, but there are no PbK. We just reject
              //the registration but we do not close the connection
              return connection.sendUTF('{"status": "ERROR",' +
                                         '"reason": "Not valid PbK sent",' +
                                         '"watoken": "' + watoken + '",' +
                                         '"messageType": "registerWA"}');
            }

            // Check if we have a token (in the connection or in the message)
            var uatoken = dataManager.getUAToken(connection) || query.data.uatoken;
            if(!uatoken) {
              log.debug("No UAToken found for this connection");
              connection.sendUTF('{ "status": "ERROR",' +
                                   '"reason": "No UAToken found for this connection!",' +
                                   '"watoken":"' + watoken + '",' +
                                   '"messageType" : "registerWA"}');
              return connection.close();
            }

            // Check if the token is correct
            if(!token.verify(uatoken)) {
              log.debug("WS::onWSMessage --> Token not valid (Checksum failed)");
              connection.sendUTF('{ "status": "ERROR",' +
                                   '"reason": "UAtoken not valid for this server",' +
                                   '"watoken":"' + watoken + '",' +
                                   '"messageType" : "registerWA"}');
              return connection.close();
            }

            log.debug("WS::onWSMessage::registerWA UAToken: " + uatoken);
            appToken = helpers.getAppToken(watoken, pbkbase64);
            dataManager.registerApplication(appToken, uatoken, pbkbase64, function(ok) {
              if (ok) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.sendUTF('{ "status": "REGISTERED",' +
                                     '"url": "' + notifyURL + '",' +
                                     '"messageType": "registerWA",' +
                                     '"watoken":"' + watoken + '"}');
                log.debug("WS::onWSMessage::registerWA --> OK registering WA");
              } else {
                connection.sendUTF('{"status": "ERROR"' +
                                    '"reason": "Try again later",' +
                                    '"watoken":"' + watoken + '",' +
                                    '"messageType" : "registerWA"}"');
                log.debug("WS::onWSMessage::registerWA --> Failing registering WA");
              }
            });
            break;

          case "unregisterWA":
            log.debug("WS::onWSMessage::unregisterWA --> Application un-registration message");
            if(!dataManager.getUAToken(connection)) {
              log.debug("No UAToken found for this connection !");
              connection.sendUTF('{ "status": "ERROR",' +
                                 '"reason": "No UAToken found for this connection!",' +
                                 '"messageType":"unregisterWA" }');
              connection.close();
              break;
            }

            appToken = helpers.getAppToken(query.data.watoken, query.data.pbkbase64);
            dataManager.unregisterApplication(appToken, dataManager.getUAToken(connection), query.data.pbkbase64, function(ok) {
              if (ok) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.sendUTF('{"status": "UNREGISTERED",' +
                                    '"url": "' + notifyURL + '",' +
                                    '"messageType": "unregisterWA"}');
                log.debug("WS::onWSMessage::unregisterWA --> OK unregistering WA");
              } else {
                connection.sendUTF('{"status": "ERROR",' +
                                    '"reason": "Try again later",' +
                                    '"messageType": "unregisterWA"}');
                log.debug("WS::onWSMessage::unregisterWA --> Failing unregistering WA");
              }
            });
            break;

          case "getAllMessages":
            if(dataManager.getUAToken(connection)) {
              log.debug('WS::onWSMessage::getAllMessages --> Not allowed on WS connections');
              connection.sendUTF('{"status": "ERROR",' +
                                  '"reason": "Command not allowed in this connection",' +
                                  '"messageType": "getAllMessages"}');
              return;
            }
            if(!query.data.uatoken) {
              log.debug("WS::onWSMessage::getAllMessages --> No UAtoken sent");
              connection.sendUTF('{"status": "ERROR",' +
                                  '"reason": "No UAtoken sent",' +
                                  '"messageType": "getAllMessages"}');
              return connection.close();
            }
            log.debug("WS::onWSMessage::getAllMessages --> Recovering messages for " + query.data.uatoken);
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage::getAllMessages --> Token not valid (Checksum failed)");
              connection.sendUTF('{"status": "ERROR",' +
                                  '"reason": "Token not valid, get a new one",' +
                                  '"messageType": "getAllMessages"}');
              return connection.close();
            } else {
              dataManager.getAllMessages(query.data.uatoken, function(messages, close) {
                connection.sendUTF(JSON.stringify(messages));
                if (close) connection.close();
                return;
              });
            }
            break;

          case "ack":
            if(query.messageId) {
              dataManager.removeMessage(query.messageId);
            }
            break;

          default:
            log.debug("WS::onWSMessage::default --> messageType not recognized");
            connection.sendUTF('{"status": "ERROR", "reason": "messageType not recognized" }');
            return connection.close();
        }
      } else if (message.type === 'binary') {
        // No binary data supported yet
        log.debug('WS::onWSMessage --> Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.sendUTF('{ "status": "ERROR", "reason": "Binary messages not yet supported" }');
        return connection.close();
      }
    };

    this.onWSClose = function(reasonCode, description) {
      self.wsConnections--;
      log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected.');
      return dataManager.unregisterNode(connection);
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
