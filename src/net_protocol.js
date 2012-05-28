/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var WebSocketServer = require('websocket').server;
var http = require('http');

var DataStore = require("./datastore.js");
var Connectors = require("./connectors/connector_base.js").getConnectorFactory();

function netProtocol(ip, port) {
  this.ip = ip;
  this.port = port;
};

netProtocol.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    // Create a new HTTP Server
    this.server = http.createServer(this.onHTTPMessage.bind(this))
    this.server.listen(this.port, this.ip);
    console.log('HTTP & WebSockets server running on ' + this.ip + ":" + this.port);

    // Websocket init
    this.wsServer = new WebSocketServer({
      httpServer: this.server,
//    keepalive: false,
//    keepaliveInterval: 200000,
      // You should not use autoAcceptConnections for production
      // applications, as it defeats all standard cross-origin protection
      // facilities built into the protocol and the browser.  You should
      // *always* verify the connection's origin and decide whether or not
      // to accept it.
      autoAcceptConnections: false
    });

    this.wsServer.on('request', this.onWSRequest);
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    console.log((new Date()) + 'HTTP: Received request for ' + request.url);
    var url = this.parseURL(request.url);
    console.log("HTTP: Parsed URL: " + JSON.stringify(url));
    switch(url.command) {
    case "token":
      var token = require("./token.js").token;
      var origin = (request.headers.origin || "*");
      response.writeHead(200, {"Content-Type": "text/plain", "access-control-allow-origin": origin} );
      response.write(token());
      break;

    case "notify":
      console.log("HTTP: Notification for " + url.token);
      var n = DataStore.getDataStore().getNode(url.token);
      n.notify("hola");
      response.writeHead(404);
      break;

    case "register":
      // We only accept application registration under the HTTP interface
      if(url.token != "app") {
        console.log("HTTP: Only application registration under this interface");
        response.writeHead(404);
        break;
      }

      console.log("HTTP: Application registration message");
      response.writeHead(404);
      break;

    default:
      console.log("HTTP: Command not recognized");
      response.writeHead(404);
    }

    // Close connection
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
        console.log('WS: Received Message: ' + message.utf8Data);
        try {
          var query = JSON.parse(message.utf8Data);
        } catch(e) {
          console.log("WS: Data received is not a valid JSON package");
          connection.sendUTF('{ "error": "Data received is not a valid JSON package" }');
          connection.close();
          return;
        }

        switch(query.command) {
        case "register/node":
          console.log("WS: Node registration message");
          var c = Connectors.getConnector(query.data, connection);
          DataStore.getDataStore().registerNode(query.data.token, c);
          break;

        case "register/app":
          console.log("WS: Application registration message");
          break;

        default:
          console.log("WS: Command not recognized");
          connection.sendUTF('{ "error": "Command not recognized" }');
          connection.close();
        }
      } else if (message.type === 'binary') {
        // No binary data supported yet
        console.log('WS: Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.sendUTF('{ "error": "Binary messages not yet supoprted" }');
        connection.close();
      }
    };

    this.onWSClose = function(reasonCode, description) {
      // TODO: De-register this node
      console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    }

    /**
     * Verify origin in order to accept or reject connections
     */
    this.originIsAllowed = function(origin) {
      // TODO: put logic here to detect whether the specified origin is allowed.
      return true;
    }

    ///////////////////////
    // Websocket creation
    ///////////////////////
    if (!this.originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var connection = request.accept('push-notification', request.origin);
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', this.onWSMessage);
    connection.on('close', this.onWSClose);
  },

  ///////////////////////
  // Auxiliar methods
  ///////////////////////
  parseURL: function(url) {
    var urlparser = require('url');
    var data = {}
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
}

// Exports
exports.networkProtocol = netProtocol;
