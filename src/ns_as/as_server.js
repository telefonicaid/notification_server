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
var uuid = require("node-uuid");
var crypto = require("../common/cryptography.js").getCrypto();
var msgBroker = require("../common/msgbroker.js").getMsgBroker();
var dataStore = require("../common/datastore.js").getDataStore();

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////

function onNewPushMessage(body, watoken) {
  var json = JSON.parse(body);
  var sig = json.signature;
  var message = json.message;
  //FIXME: get pbk from the DB
  var pbk = "\
-----BEGIN PUBLIC KEY-----\n\
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDFW14SniwCfJS//oKxSHin/uC1\n\
P6IBHiIvYr2MmhBRcRy0juNJH8OVgviFKEV3ihHiTLUSj94mgflj9RxzQ/0XR8tz\n\
PywKHxSGw4Amf7jKF1ZshCUdyrOi8cLfzdwIz1nPvDF4wwbi2fqseX5Y7YlYxfpF\n\
lx8GvbnYJHO/50QGkQIDAQAB\n\
-----END PUBLIC KEY-----";
  if (sig && !crypto.verifySignature(message, sig, pbk)) {
      log.info('Bad signature, dropping notification');
      return;
  }
  log.debug('Message not signed');
  var id = uuid.v1();
  log.debug("Storing message '" + body + "' for the " + watoken + " WA. Id: " + id);
  // Store on persistent database
  msgBroker.push("newMessages", body, false);
  dataStore.newMessage(id, watoken, body);
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
    log.info('HTTP push AS server running on ' + this.ip + ":" + this.port);
    // Connect to the message broker
    msgBroker.init(function(){});
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    log.debug((new Date()) + 'HTTP: Received request for ' + request.url);
    var url = this.parseURL(request.url);
    this.status = "";
    this.text = "";
    log.debug("HTTP: Parsed URL: " + JSON.stringify(url));
    switch(url.command) {
      case "notify":
        log.debug("HTTP: Notification for " + url.token);
        request.on("data", function(body) {
          onNewPushMessage(body, url.token);
        });
        break;
      default:
        log.debug("HTTP: Command '" + url.command + "' not recognized");
        this.status = 404;
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
