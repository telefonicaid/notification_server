/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js");
var WebSocketServer = require('websocket').server;
var http = require('http');
var dataManager = require("./datamanager.js");
var Connectors = require("./connectors/connector_base.js").getConnectorFactory();
var token = require("../common/token.js");
var helpers = require("../common/helpers.js");
var msgBroker = require("../common/msgbroker.js");
var config = require("../config.js").NS_UA_WS;
var log = require("../common/logger.js"),
    WebSocketServer = require('websocket').server,
    http = require('http'),
    crypto = require("../common/cryptography.js"),
    dataManager = require("./datamanager.js"),
    Connectors = require("./connectors/connector_base.js").getConnectorFactory(),
    token = require("../common/token.js"),
    helpers = require("../common/helpers.js"),
    msgBroker = require("../common/msgbroker.js"),
    config = require("../config.js").NS_UA_WS;

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
  log.debug("WS::Queue::onNewMessage --> Notifying node: " + JSON.stringify(json.uatoken));
  dataManager.getNode(json.uatoken, function(nodeConnector) {
    if(nodeConnector) {
      log.debug("WS::Queue::onNewMessage --> Sending messages: " + JSON.stringify(json.payload.payload));
      nodeConnector.notify(new Array(json.payload.payload));
    } else {
      log.info("WS::Queue::onNewMessage --> No node found");
    }
  });
}
////////////////////////////////////////////////////////////////////////////////

function server(ip, port) {
  this.ip = ip;
  this.port = port;
  this.ready = false;
  this.tokensGenerated = 0;
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////
  init: function() {
    // Create a new HTTP Server
    this.server = http.createServer(this.onHTTPMessage.bind(this));
    this.server.listen(this.port, this.ip);
    log.info('WS::server::init --> HTTP push UA_WS server running on ' + this.ip + ":" + this.port);

    // Websocket init
    this.wsServer = new WebSocketServer({
      httpServer: this.server,
      keepalive: config.websocket_params.keepalive,
      keepaliveInterval: config.websocket_params.keepaliveInterval,
      dropConnectionOnKeepaliveTimeout: config.websocket_params.dropConnectionOnKeepaliveTimeout,
      keepaliveGracePeriod: config.websocket_params.keepaliveGracePeriod,
      //False for production
      autoAcceptConnections: false
    });
    this.wsServer.on('request', this.onWSRequest);

    // Subscribe to my own Quesue
    var self = this;
    msgBroker.init(function() {
      var args = { durable: false, autoDelete: true, arguments: { 'x-ha-policy': 'all' } };
      msgBroker.subscribe(process.serverId, args, function(msg) { onNewMessage(msg); });
      self.ready = true;
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    var status = null;
    var text = null;
    if (!this.ready) {
      log.error('WS:onHTTPMessage --> Request received but not ready yet');
      text = '{"error": "Server not ready. Try again."}';
      status = 404;
    } else {
      log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
      var url = this.parseURL(request.url);

      log.debug("WS::onHTTPMessage --> Parsed URL: " + JSON.stringify(url));
      if (url.messageType == 'token') {
        text = token.get();
        tokensGenerated++;
        status = 200;
        this.tokensGenerated++;
      } else {
        log.debug("WS::onHTTPMessage --> messageType not recognized");
        text = '{"error": "messageType not recognized for this HTTP API"}';
        status = 404;
      }
    }
      // Close connection
      response.statusCode = status;
      response.setHeader("Content-Type", "text/plain");
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
          log.error(e);
          log.info("WS::onWSMessage --> Data received is not a valid JSON package");
          connection.sendUTF('{ "status": "error", "reason": "Data received is not a valid JSON package" }');
          return connection.close();
        }

        switch(query.messageType) {
          case "registerUA":
            log.debug("WS::onWSMessage --> UA registration message");
            // Token verification
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage --> Token not valid (Checksum failed)");
              connection.sendUTF('{ "status": "ERROR", "reason": "Token not valid for this server" }');
              return connection.close();
            }
            // New UA registration
            dataManager.registerNode(
              query.data.uatoken,
              Connectors.getConnector(query.data, connection),
              function(ok) {
                if (ok) {
                  connection.sendUTF('{"status":"REGISTERED", "messageType": "registerUA"}');
                  log.debug("WS::onWSMessage --> OK register UA");
                } else {
                  connection.sendUTF('{"status":"ERROR"}');
                  log.info("WS::onWSMessage --> Failing registering UA");
                }
              }
            );
            break;

          case "registerWA":
            log.debug("WS::onWSMessage::registerWA --> Application registration message");
            if(!dataManager.getUAToken(connection)) {
              log.error("No UAToken found for this connection !");
              connection.sendUTF('{ "status": "ERROR", "reason": "No UAToken found for this connection !" }');
              break;
            }

            log.debug("WS::onWSMessage::registerWA UAToken: " + dataManager.getUAToken(connection));
            appToken = helpers.getAppToken(query.data.watoken, query.data.pbkbase64);
            dataManager.registerApplication(appToken, dataManager.getUAToken(connection), query.data.pbkbase64, function(ok) {
              if (ok) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.sendUTF('{"status": "REGISTERED", "url": "' + notifyURL + '", "messageType": "registerWA"}');
                log.debug("WS::onWSMessage::registerWA --> OK registering WA");
              } else {
                connection.sendUTF('"status": "ERROR"');
                log.info("WS::onWSMessage::registerWA --> Failing registering WA");
              }
            });
            break;

          case "unregisterWA":
            log.debug("WS::onWSMessage::unregisterWA --> Application un-registration message");
            if(!dataManager.getUAToken(connection)) {
              log.error("No UAToken found for this connection !");
              connection.sendUTF('{ "status": "ERROR", "reason": "No UAToken found for this connection !" }');
              break;
            }

            appToken = helpers.getAppToken(query.data.watoken, query.data.pbkbase64);
            dataManager.unregisterApplication(appToken, dataManager.getUAToken(connection), query.data.pbkbase64, function(ok) {
              if (ok) {
                var notifyURL = helpers.getNotificationURL(appToken);
                connection.sendUTF('{"status": "UNREGISTERED", "url": "' + notifyURL + '", "messageType": "unregisterWA"}');
                log.debug("WS::onWSMessage::unregisterWA --> OK unregistering WA");
              } else {
                connection.sendUTF('"status": "ERROR"');
                log.info("WS::onWSMessage::unregisterWA --> Failing unregistering WA");
              }
            });
            break;

          case "getAllMessages":
            if(!query.data.uatoken) {
              log.debug("WS::onWSMessage::getAllMessages --> No UAtoken sent");
              connection.sendUTF('{ "error": "No UAtoken sent", "reason": "No UAToken sent" }');
              return connection.close();
            }
            log.debug("WS::onWSMessage::getAllMessages --> Recovering messages for " + query.data.uatoken);
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage::getAllMessages --> Token not valid (Checksum failed)");
              connection.sendUTF('{ "error": "Token received is not accepted. Please get a valid one" }');
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
            connection.sendUTF('{ "error": "messageType not recognized" }');
            return connection.close();
        }
      } else if (message.type === 'binary') {
        // No binary data supported yet
        log.info('WS::onWSMessage --> Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.sendUTF('{ "error": "Binary messages not yet supported" }');
        return connection.close();
      }
    };

    this.onWSClose = function(reasonCode, description) {
      // TODO: De-register this node
      log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected.');
      return dataManager.unregisterNode(connection);
    };

    /**
     * Verify origin in order to accept or reject connections
     */
    this.originIsAllowed = function(origin) {
      // TODO: put logic here to detect whether the specified origin is allowed.
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
    log.debug('WS::onHTTPMessage --> Connection accepted.');
    connection.on('message', this.onWSMessage);
    connection.on('close', this.onWSClose);
  },

  ///////////////////////
  // Auxiliar methods
  ///////////////////////
  parseURL: function(url) {
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
