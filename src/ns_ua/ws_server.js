/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js").getLogger;
var WebSocketServer = require('websocket').server;
var http = require('http');
var crypto = require("../common/cryptography.js").getCrypto();
var dataManager = require("./datamanager.js").getDataManager();
var Connectors = require("./connectors/connector_base.js").getConnectorFactory();
var token = require("../common/token.js").getToken();
var msgBroker = require("../common/msgbroker.js").getMsgBroker();
var config = require("../config.js").NS_UA_WS;

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewMessage(messageId) {
  log.debug('WS::onNewMessage --> New message received');
  var json = JSON.parse(messageId.body);
  log.debug("WS::onNewMessage --> Notifying node: " + JSON.stringify(json.uatoken));
  var nodeConnector = dataManager.getNode(json.uatoken);
  if(nodeConnector) {
    log.debug("WS::onNewMessage --> Sending messages: " + json.payload.payload.toString());
    nodeConnector.notify(new Array(json.payload.payload));
  } else {
    log.info("WS::onNewMessage --> No node found");
  }
}
////////////////////////////////////////////////////////////////////////////////

function server(ip, port) {
  this.ip = ip;
  this.port = port;
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
      keepalive: require('../config.js').NS_UA_WS.websocket_params.keepalive,
      keepaliveInterval: require('../config.js').NS_UA_WS.websocket_params.keepaliveInterval,
      dropConnectionOnKeepaliveTimeout: require('../config.js').NS_UA_WS.websocket_params.dropConnectionOnKeepaliveTimeout,
      keepaliveGracePeriod: require('../config.js').NS_UA_WS.websocket_params.keepaliveGracePeriod,
      //False for production
      autoAcceptConnections: false
    });
    this.wsServer.on('request', this.onWSRequest);

    // Subscribe to my own Queue
    msgBroker.init(function() {
      msgBroker.subscribe(process.serverId, function(msg) { onNewMessage(msg); });
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
    var url = this.parseURL(request.url);
    var status = null;
    var text = null;

    log.debug("WS::onHTTPMessage --> Parsed URL: " + JSON.stringify(url));
    if (url.messageType == 'token') {
      text = token.get();
      status = 200;
    } else {
      log.debug("WS::onHTTPMessage --> messageType not recognized");
      text = '{"error": "messageType not recognized for this HTTP API"}';
      status = 404;
    }

    // Close connection
    response.statusCode = status;
    response.setHeader("Content-Type", "text/plain");
    response.setHeader("access-control-allow-origin", "*");
    response.write(text);
    response.end();
  },

  //////////////////////////////////////////////
  // WebSocket callbacks
  //////////////////////////////////////////////
  onWSRequest: function(request) {
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
          log.info("WS::onWSMessage --> Data received is not a valid JSON package");
          connection.sendUTF('{ "error": "Data received is not a valid JSON package" }');
          connection.close();
          return;
        }

        switch(query.messageType) {
          case "registerUA":
            log.debug("WS::onWSMessage --> UA registration message");
            // Token verification
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage --> Token not valid (Checksum failed)");
              connection.sendUTF('{ "error": "Token received is not accepted. Please get a valid one" }');
              connection.close();
              return;
            }
            // New UA registration
            dataManager.registerNode(
              query.data.uatoken,
              Connectors.getConnector(query.data, connection)
            );
            connection.sendUTF('{"status":"REGISTERED"}');
            log.debug("WS::onWSMessage --> OK register UA");
            break;

          case "registerWA":
            log.debug("WS::onWSMessage::registerWA --> Application registration message");
            var appToken = crypto.hashSHA256(query.data.watoken);
            dataManager.registerApplication(appToken, query.data.uatoken);
            var baseURL = require('../config.js').NS_AS.publicBaseURL;
            connection.sendUTF(baseURL + "/notify/" + appToken);
            log.debug("WS::onWSMessage::registerWA --> OK registering WA");
            break;

          case "getAllMessages":
            if(!query.data.uatoken) {
              log.debug("WS::onWSMessage::getAllMessages --> No UAtoken sent");
              connection.sendUTF('{ "error": "No UAtoken sent" }');
              connection.close();
              return;
            }
            log.debug("WS::onWSMessage::getAllMessages --> Recovering messages for " + query.data.uatoken);
            if(!token.verify(query.data.uatoken)) {
              log.debug("WS::onWSMessage::getAllMessages --> Token not valid (Checksum failed)");
              connection.sendUTF('{ "error": "Token received is not accepted. Please get a valid one" }');
              connection.close();
              return;
            } else {
              dataManager.getAllMessages(query.data.uatoken, function(messages) {
                connection.sendUTF(JSON.stringify(messages));
                connection.close();
                return;
              });
            }
            break;

          default:
            log.debug("WS::onWSMessage::default --> messageType not recognized");
            connection.sendUTF('{ "error": "messageType not recognized" }');
            connection.close();
            return;
        }
      } else if (message.type === 'binary') {
        // No binary data supported yet
        log.info('WS::onWSMessage --> Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.sendUTF('{ "error": "Binary messages not yet supported" }');
        connection.close();
      }
    };

    this.onWSClose = function(reasonCode, description) {
      // TODO: De-register this node
      log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected.');
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
      request.reject();
      log.debug('WS:: --> Connection from origin ' + request.origin + ' rejected.');
      return;
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
  }
};

// Exports
exports.server = server;
