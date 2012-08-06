/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js").getLogger;
var consts = require("../consts.js").consts;
var http = require('http');
var uuid = require("node-uuid");
var crypto = require("../common/cryptography.js").getCrypto();
var msgBroker = require("../common/msgbroker.js").getMsgBroker();
var dataStore = require("../common/datastore.js").getDataStore();

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewPushMessage(notification, watoken) {
  var json = null;
  //Only accept valid JSON messages
  try {
    json = JSON.parse(notification);
  } catch (err) {
    log.info('Not valid JSON notification');
    return;
  }
  //Only accept notification messages
  if (json.messageType != "notification") return;
  var sig = json.signature;
  var message = json.message;
  //Bad notification, drop it.
  if (message.length > consts.MAX_PAYLOAD_SIZE) {
    log.debug('Notification with a big body (' + message.length + '>' + consts.MAX_PAYLOAD_SIZE + 'bytes), rejecting');
    return;
  }
  dataStore.getPbkApplication(watoken, function(pbkbase64) {
    var pbk = new Buffer(pbkbase64, 'base64').toString('ascii');
    if (sig && !crypto.verifySignature(message, sig, pbk)) {
        log.info('Bad signature, dropping notification');
        return;
    }
    var id = uuid.v1();
    log.debug("Storing message '" + JSON.stringify(json) + "' for the '" + watoken + "'' WAtoken. Internal Id: " + id);
    // Store on persistent database
    var msg = dataStore.newMessage(id, watoken, json);
    // Also send to the newMessages Queue
    msgBroker.push("newMessages", msg, false);
  });
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
    if (!url.token) {
      log.debug('No valid url (no watoken)');
      response.statusCode = 404;
      response.write('No valid WAtoken');
      response.end();
      return;
    }
    var status = "";
    var text = "";
    log.debug("HTTP: Parsed URL: " + JSON.stringify(url));
    if (url.messageType == 'notify') {
      log.debug("HTTP: Notification for " + url.token);
      request.on("data", function(notification) {
        onNewPushMessage(notification, url.token);
      });
    } else {
        log.debug("HTTP: messageType '" + url.messageType + "' not recognized");
        status = 404;
    }

    // Close connection
    response.statusCode = status;
    response.setHeader("Content-Type", "text/plain");
    response.setHeader("access-control-allow-origin", "*");
    response.write(text);
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
