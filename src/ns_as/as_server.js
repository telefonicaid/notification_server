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

var TESTING = consts.TESTING;

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewPushMessage(notification, watoken, callback) {
  var json = null;
  //Only accept valid JSON messages
  try {
    json = JSON.parse(notification);
  } catch (err) {
    log.info('NS_AS::onNewPushMessage --> Not valid JSON notification');
    callback('{"status":"ERROR", "reason":"JSON not valid"', 400);
    return;
  }
  //Only accept notification messages
  if (json.messageType != "notification") {
    callback('{"status":"ERROR", "reason":"Not messageType=notification"', 400);
    return;
  }
  var sig = json.signature;
  var message = json.message;
  if (message.length > consts.MAX_PAYLOAD_SIZE) {
    log.debug('NS_AS::onNewPushMessage --> Notification with a big body (' + message.length + '>' + consts.MAX_PAYLOAD_SIZE + 'bytes), rejecting');
    callback('{"status":"ERROR", "reason":"Body too big"', 200);
    return;
  }
  dataStore.getPbkApplication(watoken, function(pbkbase64) {
    if (pbkbase64) {
      var pbk = new Buffer(pbkbase64, 'base64').toString('ascii');
      if (sig && !crypto.verifySignature(message, sig, pbk)) {
        log.info('NS_AS::onNewPushMessage --> Bad signature, dropping notification');
        callback('{"status":"ERROR", "reason":"Bad signature, dropping notification"', 400);
        return;
      }
    }
    var id = uuid.v1();
    log.debug("NS_AS::onNewPushMessage --> Storing message '" + JSON.stringify(json) + "' for the '" + watoken + "'' WAtoken. Internal Id: " + id);
    // Store on persistent database
    var msg = dataStore.newMessage(id, watoken, json);
    // Also send to the newMessages Queue
    msgBroker.push("newMessages", msg, false);
    callback('{"status": "ACCEPTED"}', 200);
    return;
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
    log.info('NS_AS::init --> HTTP push AS server running on ' + this.ip + ":" + this.port);
    // Connect to the message broker
    msgBroker.init(function(){});
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    log.debug('NS_AS::onHTTPMessage --> Received request for ' + request.url);
    var url = this.parseURL(request.url);
    if (!url.token) {
      log.debug('NS_AS::onHTTPMessage --> No valid url (no watoken)');
      response.statusCode = 404;
      response.write('{"status": "ERROR", "reason": "No valid WAtoken"');
      response.end();
      return;
    }
    log.debug("NS_AS::onHTTPMessage --> Parsed URL: " + JSON.stringify(url));
    if (url.messageType == 'notify') {
      log.debug("NS_AS::onHTTPMessage --> Notification for " + url.token);
      request.on("data", function(notification) {
        onNewPushMessage(notification, url.token, function(body, code) {
            response.statusCode = code;
            response.setHeader("Content-Type", "text/plain");
            response.setHeader("access-control-allow-origin", "*");
            response.write(body);
            response.end();
        });
      });
    } else {
      log.debug("NS_AS::onHTTPMessage --> messageType '" + url.messageType + "' not recognized");
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/plain");
      response.setHeader("access-control-allow-origin", "*");
      response.write('{"status": "ERROR", "reason": "Only notify by this interface"}');
      response.end();
    }
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
exports.onNewPushMessage = onNewPushMessage;
