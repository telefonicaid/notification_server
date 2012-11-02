/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger"),
    consts = require("../config.js").consts,
    https = require('https'),
    fs = require('fs'),
    uuid = require("node-uuid"),
    crypto = require("../common/cryptography"),
    msgBroker = require("../common/msgbroker"),
    dataStore = require("../common/datastore"),
    errorcodes = require("../common/constants").errorcodes.GENERAL,
    errorcodesAS = require("../common/constants").errorcodes.AS;

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewPushMessage(notification, apptoken, callback) {
  var json = null;

  //Only accept valid JSON messages
  try {
    json = JSON.parse(notification);
  } catch (err) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Not valid JSON notification');
    return callback(errorcodesAS.JSON_NOTVALID_ERROR);
  }

  //Get all attributes and save it to a new normalized notification
  //Also, set not initialized variables.
  var normalizedNotification = {};

  //These are mandatory
  normalizedNotification.messageType = json.messageType;
  //normalizedNotification.sig = json.signature;
  normalizedNotification.id = json.id;

  //This are optional, but we set to default parameters
  normalizedNotification.message = json.message || '';
  normalizedNotification.ttl = json.ttl || consts.MAX_TTL;
  normalizedNotification.timestamp = json.timestamp || (new Date()).getTime();
  normalizedNotification.priority = json.priority || '4';

  //Only accept notification messages
  if (normalizedNotification.messageType != "notification") {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Not valid messageType');
    return callback(errorcodesAS.BAD_MESSAGE_TYPE_NOT_NOTIFICATION);
  }

  //If not signed, reject
  if (!json.signature) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Not signed');
    return callback(errorcodesAS.BAD_MESSAGE_NOT_SIGNED);
  }

  //If not id, reject
  if (!normalizedNotification.id) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Not id');
    return callback(errorcodesAS.BAD_MESSAGE_NOT_ID);
  }

  //Reject notifications with big attributes
  if ((normalizedNotification.message.length > consts.MAX_PAYLOAD_SIZE) ||
      (normalizedNotification.id.length > consts.MAX_PAYLOAD_SIZE)) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Notification with a big body (' + normalizedNotification.message.length + '>' + consts.MAX_PAYLOAD_SIZE + 'bytes), rejecting');
    return callback(errorcodesAS.BAD_MESSAGE_BODY_TOO_BIG);
  }

  //Get the PbK for the apptoken in the database
  dataStore.getPbkApplication(apptoken, function(pbkbase64) {
    var pbk = new Buffer(pbkbase64 || '', 'base64').toString('ascii');
    if (!crypto.verifySignature(normalizedNotification.message, json.signature, pbk)) {
      log.debug('NS_AS::onNewPushMessage --> Rejected. Bad signature, dropping notification');
      return callback(errorcodesAS.BAD_MESSAGE_BAD_SIGNATURE);
    }

    var id = uuid.v1();
    log.debug("NS_AS::onNewPushMessage --> Storing message for the '" + apptoken + "' apptoken with internal Id = '" + id + "'. Message:", normalizedNotification);
    log.notify("Storing message for the '" + apptoken + "'' apptoken. Internal Id: " + id);
    // Store on persistent database
    var msg = dataStore.newMessage(id, apptoken, normalizedNotification);
    // Also send to the newMessages Queue
    msgBroker.push("newMessages", msg);
    return callback(errorcodes.NO_ERROR);
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
    // Create a new HTTPS Server
    var options = {
      key: fs.readFileSync(consts.key),
      cert: fs.readFileSync(consts.cert)
    };
    this.server = https.createServer(options, this.onHTTPMessage.bind(this));
    this.server.listen(this.port, this.ip);
    log.info('NS_AS::init --> HTTP push AS server starting on ' + this.ip + ":" + this.port);

    // Events from msgBroker
    msgBroker.on('brokerconnected', function() {
      log.info("NS_AS::init --> MsgBroker ready and connected");
      this.msgbrokerready = true;
    }.bind(this));
    msgBroker.on('brokerdisconnected', function() {
      log.critical("NS_AS::init --> MsgBroker DISCONNECTED!!");
      this.msgbrokerready = false;
    }.bind(this));

    //Events from dataStore
    dataStore.on('ddbbconnected', function() {
      log.info("NS_AS::init --> DataStore ready and connected");
      this.ddbbready = true;
    }.bind(this));
    dataStore.on('ddbbdisconnected', function() {
      log.critical("NS_AS::init --> DataStore DISCONNECTED!!");
      this.ddbbready = false;
    }.bind(this));

    //Wait until we have setup our events listeners
    setTimeout(function() {
      msgBroker.init();
      dataStore.init();
    }, 10);

    // Check if we are alive
    var self = this;
    setTimeout(function() {
      if (!self.ddbbready || !self.msgbrokerready)
        log.critical('30 seconds has passed and we are not ready, closing');
    }, 30*1000); //Wait 30 seconds

  },

  stop: function(callback) {
    var self = this;
    this.server.close(function() {
      log.info('NS_AS::stop --> NS_AS closed correctly');
      self.ddbbready = false;
      self.msgbrokerready = false;
      callback(null);
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    if (!this.ddbbready || !this.msgbrokerready) {
      log.debug('NS_AS::onHTTPMessage --> Message rejected, we are not ready yet');
      return this.responseError(errorcodes.NOT_READY, response);
    }

    log.debug('NS_AS::onHTTPMessage --> Received request for ' + request.url);
    var url = this.parseURL(request.url);
    log.debug("NS_AS::onHTTPMessage --> Parsed URL:", url);
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
        return this.responseError(errorcodes.NOT_ALLOWED_ON_PRODUCTION_SYSTEM, response);
      }
      break;

    case 'notify':
      if (!url.token) {
        log.debug('NS_AS::onHTTPMessage --> No valid url (no apptoken)');
        return this.responseError(errorcodesAS.BAD_URL_NOT_VALID_APPTOKEN, response);
      }

      log.debug("NS_AS::onHTTPMessage --> Notification for " + url.token);
      var self = this;
      request.on("data", function(notification) {
        onNewPushMessage(notification, url.token, function(err) {
          self.responseError(err, response);
        });
      });
      break;

    default:
      log.debug("NS_AS::onHTTPMessage --> messageType '" + url.messageType + "' not recognized");
      return this.responseError(errorcodesAS.BAD_URL, response)
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
  },

  responseError: function(errorCode, response) {
    log.debug('NS_AS::responseError: ', errorCode);
    response.statusCode = errorCode[0];
    response.setHeader("access-control-allow-origin", "*");
    if(consts.PREPRODUCTION_MODE) {
      response.setHeader("Content-Type", "text/plain");
      if(response.statusCode == 200) {
        response.write('{"status":"ACCEPTED"}');
      } else {
        response.write('{"status":"ERROR", "'+errorCode[1]+'"}');
      }
    }
    return response.end();
  }
};

// Exports
exports.server = server;
