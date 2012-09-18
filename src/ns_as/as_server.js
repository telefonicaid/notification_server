/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger"),
    consts = require("../config.js").consts,
    http = require('http'),
    uuid = require("node-uuid"),
    crypto = require("../common/cryptography"),
    msgBroker = require("../common/msgbroker"),
    dataStore = require("../common/datastore");

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
    return callback('{"status":"ERROR", "reason":"JSON not valid"}', 400);
  }
  //Only accept notification messages
  if (json.messageType != "notification") {
    return callback('{"status":"ERROR", "reason":"Not messageType=notification"}', 400);
  }
  var sig = json.signature,
      message = json.message;
  if (message.length > consts.MAX_PAYLOAD_SIZE) {
    log.debug('NS_AS::onNewPushMessage --> Notification with a big body (' + message.length + '>' + consts.MAX_PAYLOAD_SIZE + 'bytes), rejecting');
    return callback('{"status":"ERROR", "reason":"Body too big"}', 400);
  }
  dataStore.getPbkApplication(watoken, function(pbkbase64) {
    if (pbkbase64) {
      if (!sig) {
        log.debug("NS_AS::onNewPushMessage --> Notification not signed where it must.");
        return callback('{"status":"ERROR", "reason":"You must sign your message with your Private Key"}', 400);
      }
      var pbk = new Buffer(pbkbase64, 'base64').toString('ascii');
      if (sig && !crypto.verifySignature(message, sig, pbk)) {
        log.info('NS_AS::onNewPushMessage --> Bad signature, dropping notification');
        return callback('{"status":"ERROR", "reason":"Bad signature, dropping notification"}', 400);
      }
    }
    var id = uuid.v1();
    log.debug("NS_AS::onNewPushMessage --> Storing message '" + JSON.stringify(json) + "' for the '" + watoken + "'' WAtoken. Internal Id: " + id);
    // Store on persistent database
    var msg = dataStore.newMessage(id, watoken, json);
    // Also send to the newMessages Queue
    msgBroker.push("newMessages", msg);
    return callback('{"status": "ACCEPTED"}', 200);
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
    log.info('NS_AS::init --> HTTP push AS server starting on ' + this.ip + ":" + this.port);

    // Events from msgBroker
    msgBroker.on('brokerconnected', function() {
      log.info("NS_AS::init --> MsgBroker ready and connected");
      this.msgbrokerready = true;
    }.bind(this));
    msgBroker.on('brokerdisconnected', function() {
      log.error("NS_AS::init --> MsgBroker DISCONNECTED!!");
      this.msgbrokerready = false;
    }.bind(this));

    //Events from dataStore
    dataStore.on('ddbbconnected', function() {
      log.info("NS_AS::init --> DataStore ready and connected");
      this.ddbbready = true;
    }.bind(this));

    //Let's wait one second to start the msgBroker and the dataStore
    dataStore.on('ddbbdisconnected', function() {
      log.info("NS_AS::init --> DataStore DISCONNECTED!!");
      this.ddbbready = false;
    });

    //Wait until we have setup our events listeners
    setTimeout(function() {
      msgBroker.init();
      dataStore.init();
    }, 10);
  },

  stop: function(callback) {
    this.server.close(function() {
      log.info('NS_AS::stop --> NS_AS closed correctly');
      this.ddbbready = false;
      this.msgbrokerready = false;
      callback(null);
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    if (!this.ddbbready || !this.msgbrokerready) {
      log.debug('NS_AS::onHTTPMessage --> Message rejected, we are not ready yet');
      response.statusCode = 404;
      response.write('{"status": "ERROR", "reason": "Try again later"}');
      return response.end();
    }

    log.debug('NS_AS::onHTTPMessage --> Received request for ' + request.url);
    var url = this.parseURL(request.url);
    log.debug("NS_AS::onHTTPMessage --> Parsed URL: " + JSON.stringify(url));
    switch (url.messageType) {
    case 'about':
      if(consts.PREPRODUCTION_MODE) {
        try {
          var fs = require("fs");
          text = "Push Notification Server (Application Server Frontend)<br />";
          text += "&copy; Telef&oacute;nica Digital, 2012<br />";
          text += "Version: " + fs.readFileSync("version.info") + "<br /><br />";
          text += "<a href=\"https://github.com/telefonicaid/notification_server\">Collaborate !</a><br />";
        } catch(e) {
          text = "No version.info file";
        }
        response.setHeader("Content-Type", "text/html");
        response.statusCode = 200;
        response.write(text);
        return response.end();
      } else {
        response.statusCode = 404;
        response.write('{"status": "ERROR", "reason": "Not allowed on production system"}');
        return response.end();
      }

    case 'notify':
      if (!url.token) {
        log.debug('NS_AS::onHTTPMessage --> No valid url (no watoken)');
        response.statusCode = 404;
        response.write('{"status": "ERROR", "reason": "No valid WAtoken"}');
        return response.end();
      }

      log.debug("NS_AS::onHTTPMessage --> Notification for " + url.token);
      request.on("data", function(notification) {
        onNewPushMessage(notification, url.token, function(body, code) {
            response.statusCode = code;
            response.setHeader("Content-Type", "text/plain");
            response.setHeader("access-control-allow-origin", "*");
            response.write(body);
            return response.end();
        });
      });
      break;

    default:
      log.debug("NS_AS::onHTTPMessage --> messageType '" + url.messageType + "' not recognized");
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/plain");
      response.setHeader("access-control-allow-origin", "*");
      response.write('{"status": "ERROR", "reason": "Only notify by this interface"}');
      return response.end();
    }
  },

  ///////////////////////
  // Auxiliar methods
  ///////////////////////
  parseURL: function(url) {
    var urlparser = require('url'),
        data = {};
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
