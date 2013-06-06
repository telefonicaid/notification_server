/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger'),
    urlparser = require('url'),
    config = require('../common/config.js'),
    consts = config.consts,
    fs = require('fs'),
    cluster = require('cluster'),
    uuid = require('node-uuid'),
    crypto = require('../common/cryptography'),
    msgBroker = require('../common/msgbroker'),
    dataStore = require('../common/datastore'),
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesAS = require('../common/constants').errorcodes.AS,
    pages = require('../common/pages.js'),
    maintance = require('../common/maintance.js'),
    helpers = require('../common/helpers.js');

var SimplePushAPI_v1 = require('./apis/SimplePushAPI_v1');
var simplepush = new SimplePushAPI_v1();

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
  if ((normalizedNotification.message.length > config.NS_AS.MAX_PAYLOAD_SIZE) ||
      (normalizedNotification.id.length > consts.MAX_ID_SIZE)) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Notification with a big body (' + normalizedNotification.message.length + '>' + config.NS_AS.MAX_PAYLOAD_SIZE + 'bytes), rejecting');
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
    log.notify(log.messages.NOTIFY_MSGSTORINGDB, {
      "apptoken": apptoken,
      "id": id
    });
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
    if (cluster.isMaster) {
      // Fork workers.
      for (var i = 0; i < config.NS_AS.numProcesses; i++) {
        cluster.fork();
      }

      cluster.on('exit', function(worker, code, signal) {
        if (code !== 0) {
          log.error(log.messages.ERROR_WORKERERROR, {
            "pid": worker.process.pid,
            "code": code
          });
        } else {
          log.info('worker ' + worker.process.pid + ' exit');
        }
      });
    } else {
      // Create a new HTTPS Server
      var options = {
        ca: helpers.getCaChannel(),
        key: fs.readFileSync(consts.key),
        cert: fs.readFileSync(consts.cert),
        requestCert: false,
        rejectUnauthorized: false
      };
      this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
      this.server.listen(this.port, this.ip);
      log.info('NS_AS::init --> HTTPS push AS server starting on ' +
        this.ip + ':' + this.port);

      var self = this;
      // Events from msgBroker
      msgBroker.once('brokerconnected', function() {
        log.info('NS_AS::init --> MsgBroker ready and connected');
        self.msgbrokerready = true;
      });
      msgBroker.once('brokerdisconnected', function() {
        log.critical(log.messages.CRITICAL_MBDISCONNECTED, {
          "class": 'NS_AS',
          "method": 'init'
        });
        self.msgbrokerready = false;
      });

      //Events from dataStore
      dataStore.once('ddbbconnected', function() {
        log.info('NS_AS::init --> DataStore ready and connected');
        self.ddbbready = true;
      });
      dataStore.on('ddbbdisconnected', function() {
        log.critical(log.messages.CRITICAL_DBDISCONNECTED, {
          "class": 'NS_AS',
          "method": 'init'
        });
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
          log.critical(log.messages.CRITICAL_NOTREADY);
      }, 30 * 1000); //Wait 30 seconds
    }
  },

  stop: function() {
    if (cluster.isMaster) {
      setTimeout(function() {
        process.exit(0);
      }, 10000);
      return;
    }
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

    // CORS support
    if (request.method === 'OPTIONS') {
      log.debug('NS_AS::onHTTPMessage --> Received an OPTIONS method');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', 'POST, PUT, GET, OPTIONS');
      return response.end();
    }

    // Frontend for the Mozilla SimplePush API
    if (request.method === 'PUT') {
      log.debug('NS_AS::onHTTPMessage --> Received a PUT');
      var body = "";
      request.on('data', function(data) {
        body += data;
      });
      request.on('end', function() {
        simplepush.processRequest(request, body, response);
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

      case 'status':
        // Return status mode to be used by load-balancers
        response.setHeader('Content-Type', 'text/html');
        if (maintance.getStatus()) {
          response.statusCode = 503;
          response.write('Under Maintance');
        } else {
          response.statusCode = 200;
          response.write('OK');
        }
        return response.end();
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
