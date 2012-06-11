/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

// TODO: Error methods
// TODO: push_url_recover_method
// TODO: verify origin
// TODO: URL Parser based on regexp
// TODO: Replies to the 3rd. party server

var WebSocketServer = require('websocket').server;
var http = require('http');

var DataStore = require("./datastore.js");
var Connectors = require("./connectors/connector_base.js").getConnectorFactory();
var token = require("./token.js").getToken;

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
      keepalive: require('./config.js').websocket_params.keepalive,
      keepaliveInterval: require('./config.js').websocket_params.keepaliveInterval,
      dropConnectionOnKeepaliveTimeout: require('./config.js').websocket_params.dropConnectionOnKeepaliveTimeout,
      keepaliveGracePeriod: require('./config.js').websocket_params.keepaliveGracePeriod,
 
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
    var status = "";
    var text = "";
    //response.writeHead(200, {"Content-Type": "text/plain", "access-control-allow-origin": "*"} );
    console.log("HTTP: Parsed URL: " + JSON.stringify(url));
    switch(url.command) {
    case "token":
      text += token.get();
      status = 200;
      break;

    case "notify":
      console.log("HTTP: Notification for " + url.token);
      request.on("data", function(data) {
        var node_list = DataStore.getDataStore().getApplication(url.token);
        if(node_list == false) {
          status = 404;
          text += '{ "error": "No application found" }';
        }
        console.log(" * Located nodes: " + JSON.stringify(node_list) );
        for(n in node_list) {
          console.log(" * Notifying node: " + node_list[n] );
          var nodeConnector = DataStore.getDataStore().getNode(node_list[n]);
          if(nodeConnector != false) {
            nodeConnector.notify(data);
            status = 200;
          } else {
            status = 400;
            text += '{ "error": "No node found" }';
          }
        }
      }.bind(this));
      break;

    case "register":
      // We only accept application registration under the HTTP interface
      if(url.token != "app") {
        console.log("HTTP: Only application registration under this interface");
        status = 404;
        break;
      }
      console.log("HTTP: Application registration message");
      DataStore.getDataStore().registerApplication(url.parsedURL.query.a,url.parsedURL.query.n);
      status = 200;
      var baseURL = require('./config.js').publicBaseURL;
      text += (baseURL + "/notify/" + url.parsedURL.query.a);
      break;

    default:
      console.log("HTTP: Command not recognized");
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
          // Token verification
          if(!token.verify(query.data.token)) {
            console.log("WS: Token not valid (Checksum failed)");
            connection.sendUTF('{ "error": "Token received is not accepted. Please get a valid one" }');
            connection.close();
            return;
          }
          var c = Connectors.getConnector(query.data, connection);
          DataStore.getDataStore().registerNode(query.data.token, c);
          break;

        case "register/app":
          console.log("WS: Application registration message");
          DataStore.getDataStore().registerApplication(query.data.apptoken,query.data.nodetoken);
          var baseURL = require('./config.js').publicBaseURL;
          connection.sendUTF(baseURL + "/notify/" + query.data.apptoken);
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
