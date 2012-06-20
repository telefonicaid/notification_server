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

var log = require("../common/logger.js").getLogger;
var http = require('http');
var crypto = require("../common/cryptography.js").getCrypto;

var DataStore = require("../common/ddbb/datastore.js");
var token = require("../common/token.js").getToken;

function server(ip, port) {
  this.ip = ip;
  this.port = port;
};

function onNewPushMessage(body, token) {
  DataStore.getDataStore().getApplication(
    token,
    function(err, replies) {
      if(replies.length == 0) {
        //status = 404;
        //text += '{ "error": "No application found" }';
      }
      replies.forEach(function (reply, i) {
        log.debug(" * Notifying node: " + i + " : " + reply);
        var nodeConnector = DataStore.getDataStore().getNode(reply);
        if(nodeConnector != false) {
          nodeConnector.notify(data);
          this.status = 200;
        } else {
          this.status = 400;
          this.text += '{ "error": "No node found" }';
        }
      })
    }
    );
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    // Create a new HTTP Server
    this.server = http.createServer(this.onHTTPMessage.bind(this))
    this.server.listen(this.port, this.ip);
    log.info('HTTP push server running on ' + this.ip + ":" + this.port);
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    log.debug((new Date()) + 'HTTP: Received request for ' + request.url);
    var url = this.parseURL(request.url);
    this.status = "";
    this.text = "";
    //response.writeHead(200, {"Content-Type": "text/plain", "access-control-allow-origin": "*"} );
    log.debug("HTTP: Parsed URL: " + JSON.stringify(url));
    switch(url.command) {
      case "token":
        this.text += token.get();
        this.status = 200;
        break;

      case "notify":
        log.debug("HTTP: Notification for " + url.token);
        request.on("data", function(body) {
          new onNewPushMessage(body, url.token);
        });
        break;

      case "register":
        // We only accept application registration under the HTTP interface
        if(url.token != "app") {
          log.debug("HTTP: Only application registration under this interface");
          this.status = 404;
          break;
        }
        log.debug("HTTP: Application registration message");
        var appToken = crypto.hashSHA256(url.parsedURL.query.a);
        DataStore.getDataStore().registerApplication(appToken,url.parsedURL.query.n);
        this.status = 200;
        var baseURL = require('../config.js').NS_AS.publicBaseURL;
        this.text += (baseURL + "/notify/" + appToken);
        break;

      default:
        log.debug("HTTP: Command not recognized");
        status = 404;
    }

    // Close connection
    response.statusCode = this.status;
    response.setHeader("Content-Type", "text/plain");
    response.setHeader("access-control-allow-origin", "*");
    response.write(this.text);
    response.end();
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
exports.server = server;
