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
  log.debug('New message for WS server');
  var json = JSON.parse(messageId.body);
  log.debug("Notifying node: " + JSON.stringify(json.uatoken));
  var nodeConnector = dataManager.getNode(json.uatoken);
  if(nodeConnector) {
    log.debug("Sending messages: " + json.payload.payload.toString());
    nodeConnector.notify(new Array(json.payload.payload));
  } else {
    log.info("No node found");
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
    log.info('HTTP push UA_WS server running on ' + this.ip + ":" + this.port);

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
    log.debug((new Date()) + 'HTTP: Received request for ' + request.url);
    var url = this.parseURL(request.url);
    var status = null;
    var text = null;

    log.debug("HTTP: Parsed URL: " + JSON.stringify(url));
    if (url.command == 'token') {
      text = token.get();
      status = 200;
    } else {
      log.debug("HTTP: Command not recognized");
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
        log.debug('WS: Received Message: ' + message.utf8Data);
        var query = null;
        try {
          query = JSON.parse(message.utf8Data);
        } catch(e) {
          log.info("WS: Data received is not a valid JSON package");
          connection.sendUTF('{ "error": "Data received is not a valid JSON package" }');
          connection.close();
          return;
        }

        switch(query.command) {
        case "registerUA":
          log.debug("WS: UA registration message");
          // Token verification
          if(!token.verify(query.data.uatoken)) {
            log.debug("WS: Token not valid (Checksum failed)");
            connection.sendUTF('{ "error": "Token received is not accepted. Please get a valid one" }');
            connection.close();
            return;
          }

          // New UA registration
          var okNode = dataManager.registerNode(
            query.data.uatoken,
            Connectors.getConnector(query.data, connection)
          );

          if (okNode) {
            connection.sendUTF('{"status":"REGISTERED"}');
            console.log("OK register UA");
            return;
          }
          connection.sendUTF('{ "error" : "Could not add UAtoken" }');
          break;

        case "registerWA":
          log.debug("WS: Application registration message");
          var appToken = crypto.hashSHA256(query.data.watoken);
          var okWA = dataManager.registerApplication(appToken, query.data.uatoken);
          if (okWA) {
            var baseURL = require('../config.js').NS_AS.publicBaseURL;
            connection.sendUTF(baseURL + "/notify/" + appToken);
            console.log("OK register WA");
            return;
          }
          connection.sendUTF('{ "error": "Could not add WA" }');
          break;
        case "getAllMessages":
          if(!query.data.uatoken)
            return;
          log.debug("WS: Pulling method called");
          log.debug("Recover all messages for:" + query.data.uatoken);
          if(!token.verify(query.data.uatoken)) {
            log.debug("WS: Token not valid (Checksum failed)");
            connection.sendUTF('{ "error": "Token received is not accepted. Please get a valid one" }');
            connection.close();
          } else {
            dataManager.getAllMessages(query.data.uatoken, function(messages) {
              connection.sendUTF(JSON.stringify(messages));
              connection.close();
            });
          }
          break;

        default:
          log.debug("WS: Command not recognized");
          connection.sendUTF('{ "error": "Command not recognized" }');
          connection.close();
        }
      } else if (message.type === 'binary') {
        // No binary data supported yet
        log.debug('WS: Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.sendUTF('{ "error": "Binary messages not yet supported" }');
        connection.close();
      }
    };

    this.onWSClose = function(reasonCode, description) {
      // TODO: De-register this node
      log.debug(' Peer ' + connection.remoteAddress + ' disconnected.');
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
      log.debug(' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var connection = request.accept('push-notification', request.origin);
    log.debug(' Connection accepted.');
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
    data.command = path[1];
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
