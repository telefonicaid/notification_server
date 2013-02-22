/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger'),
    urlparser = require('url'),
    consts = require('../config.js').consts,
    fs = require('fs'),
    uuid = require('node-uuid'),
    crypto = require('../common/cryptography'),
    msgBroker = require('../common/msgbroker'),
    dataStore = require('../common/datastore'),
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesAS = require('../common/constants').errorcodes.AS,
    pages = require('../common/pages.js');

var MozillaASv1 = require('./mozilla/MozillaASv1');

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewPushMessage(notification, certificate, apptoken, callback) {
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
  normalizedNotification.id = json.id;

  //This are optional, but we set to default parameters
  normalizedNotification.message = json.message || '';
  normalizedNotification.ttl = json.ttl || consts.MAX_TTL;
  normalizedNotification.timestamp = json.timestamp || (new Date()).getTime();
  normalizedNotification.priority = json.priority ||  '4';

  //Reject if no valid certificate is received
  if (!certificate.fingerprint) {
    return callback(errorcodesAS.BAD_MESSAGE_BAD_CERTIFICATE);
  }

  //Only accept notification messages
  if (normalizedNotification.messageType != 'notification') {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Not valid messageType');
    return callback(errorcodesAS.BAD_MESSAGE_TYPE_NOT_NOTIFICATION);
  }

  //If bad id (null, undefided or empty), reject
  if ((normalizedNotification.id == null) || (normalizedNotification.id == '')) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Bad id');
    return callback(errorcodesAS.BAD_MESSAGE_BAD_ID);
  }

  //Reject notifications with big attributes
  if ((normalizedNotification.message.length > consts.MAX_PAYLOAD_SIZE) ||
      (normalizedNotification.id.length > consts.MAX_ID_SIZE)) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Notification with a big body (' + normalizedNotification.message.length + '>' + consts.MAX_PAYLOAD_SIZE + 'bytes), rejecting');
    return callback(errorcodesAS.BAD_MESSAGE_BODY_TOO_BIG);
  }

  //Get the Certificate for the apptoken in the database
  dataStore.getCertificateApplication(apptoken, function(error, cert) {
    if (error) {
      return callback(errorcodesAS.BAD_MESSAGE_BAD_CERTIFICATE);
    }
    if (!cert) {
      log.debug('NS_AS::onNewPushMessage --> Rejected. AppToken not found, dropping notification');
      return callback(errorcodesAS.BAD_URL_NOT_VALID_APPTOKEN);
    }

    if (crypto.hashSHA256(certificate.fingerprint) != cert.fs) {
      log.debug('NS_AS::onNewPushMessage --> Rejected. Bad certificate, dropping notification');
      return callback(errorcodesAS.BAD_MESSAGE_BAD_CERTIFICATE);
    }

    var id = uuid.v1();
    log.debug("NS_AS::onNewPushMessage --> Storing message for the '" + apptoken + "' apptoken with internal Id = '" + id + "'. Message:", normalizedNotification);
    log.notify("Storing message for the '" + apptoken + "' apptoken. Internal Id: " + id);
    // Store on persistent database
    var msg = dataStore.newMessage(id, apptoken, normalizedNotification);
    // Also send to the newMessages Queue
    msgBroker.push('newMessages', msg);
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
      cert: fs.readFileSync(consts.cert),
      requestCert: true,
      rejectUnauthorized: false
    };
    this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
    this.server.listen(this.port, this.ip);
    log.info('NS_AS::init --> HTTPS push AS server starting on ' +
      this.ip + ':' + this.port);

    var self = this;
    // Events from msgBroker
    msgBroker.on('brokerconnected', function() {
      log.info('NS_AS::init --> MsgBroker ready and connected');
      self.msgbrokerready = true;
    });
    msgBroker.on('brokerdisconnected', function() {
      log.critical('NS_AS::init --> MsgBroker DISCONNECTED!!');
      self.msgbrokerready = false;
    });

    //Events from dataStore
    dataStore.on('ddbbconnected', function() {
      log.info('NS_AS::init --> DataStore ready and connected');
      self.ddbbready = true;
    });
    dataStore.on('ddbbdisconnected', function() {
      log.critical('NS_AS::init --> DataStore DISCONNECTED!!');
      self.ddbbready = false;
    });

    //Wait until we have setup our events listeners
    process.nextTick(function() {
      msgBroker.init();
      dataStore.init();
    });

    // Check if we are alive
    setTimeout(function() {
      if (!self.ddbbready || !self.msgbrokerready)
        log.critical('30 seconds has passed and we are not ready, closing');
    }, 30 * 1000); //Wait 30 seconds

  },

  stop: function() {
    var self = this;
    this.server.close(function() {
      log.info('NS_AS::stop --> NS_AS closed correctly');
      self.ddbbready = false;
      self.msgbrokerready = false;
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    log.debug('[onHTTPMessage auth]', request.connection.authorizationError);
    log.debug('[onHTTPMessage received certificate]',
      request.connection.getPeerCertificate());

    response.res = function responseHTTP(errorCode) {
      log.debug('NS_AS::responseHTTP: ', errorCode);
      this.statusCode = errorCode[0];
      this.setHeader('access-control-allow-origin', '*');
      if (consts.PREPRODUCTION_MODE) {
        this.setHeader('Content-Type', 'text/plain');
        if (this.statusCode == 200) {
          this.write('{"status":"ACCEPTED"}');
        } else {
          this.write('{"status":"ERROR", "reason":"' + errorCode[1] + '"}');
        }
      }
      return this.end();
    };

    if (!this.ddbbready || !this.msgbrokerready) {
      log.debug('NS_AS::onHTTPMessage --> Message rejected, we are not ready yet');
      return response.res(errorcodes.NOT_READY);
    }

    log.debug('NS_AS::onHTTPMessage --> Received request for ' + request.url);
    var url = urlparser.parse(request.url, true);
    var path = url.pathname.split('/');
    log.debug('NS_AS::onHTTPMessage --> Splitted URL path: ', path);

    // Frontend for the Mozilla SimplePush API
    if (request.method === 'PUT') {
      log.debug('NS_AS::onHTTPMessage --> Received a PUT');
      var moz = new MozillaASv1();
      request.on('data', function(body) {
        moz.processRequest(request, body, response);
      });
      return;
    }

    switch (path[1]) {
      case 'about':
        if (consts.PREPRODUCTION_MODE) {
          try {
            var p = new pages();
            p.setTemplate('views/about.tmpl');
            text = p.render(function(t) {
              switch (t) {
                case '{{GIT_VERSION}}':
                  return require('fs').readFileSync('version.info');
                case '{{MODULE_NAME}}':
                  return 'Application Server Frontend';
                default:
                  return '';
              }
            });
          } catch(e) {
            text = "No version.info file";
          }
          response.setHeader('Content-Type', 'text/html');
          response.statusCode = 200;
          response.write(text);
          return response.end();
        } else {
          return response.res(errorcodes.NOT_ALLOWED_ON_PRODUCTION_SYSTEM);
        }
        break;

      case 'notify':
        var token = path[2];
        if (!token) {
          log.debug('NS_AS::onHTTPMessage --> No valid url (no apptoken)');
          return response.res(errorcodesAS.BAD_URL_NOT_VALID_APPTOKEN);
        }
        if (request.method != 'POST') {
          log.debug('NS_AS::onHTTPMessage --> No valid method (only POST for notifications)');
          return response.res(errorcodesAS.BAD_URL_NOT_VALID_METHOD);
        }

        log.debug('NS_AS::onHTTPMessage --> Notification for ' + token);
        request.on('data', function(notification) {
          onNewPushMessage(notification, request.connection.getPeerCertificate(), token, function(err) {
            response.res(err);
          });
        });
        break;
        return;

      default:
        log.debug("NS_AS::onHTTPMessage --> messageType '" + path[1] + "' not recognized");
        return response.res(errorcodesAS.BAD_URL);
    }
  }
};

// Exports
exports.server = server;
