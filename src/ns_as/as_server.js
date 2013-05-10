/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger'),
    urlparser = require('url'),
    config = require('../config.js'),
    consts = config.consts,
    fs = require('fs'),
    uuid = require('node-uuid'),
    crypto = require('../common/cryptography'),
    msgBroker = require('../common/msgbroker'),
    dataStore = require('../common/datastore'),
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesAS = require('../common/constants').errorcodes.AS,
    pages = require('../common/pages.js'),
    maintenance = require('../common/maintenance.js');

var apis = [];
apis[0] = require('./apis/SimplePushAPI_v1');
apis[1] = require('./apis/ExtendedPushAPI_v1');
apis[2] = require('./apis/infoAPI');

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
      requestCert: false,
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
      log.critical(log.messages.CRITICAL_MBDISCONNECTED, {
        "class": 'NS_AS',
        "method": 'init'
      });
      self.msgbrokerready = false;
    });

    //Events from dataStore
    dataStore.on('ddbbconnected', function() {
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

    // CORS support
    if (request.method === 'OPTIONS') {
      log.debug('NS_AS::onHTTPMessage --> Received an OPTIONS method');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', 'POST, PUT, GET, OPTIONS');
      return response.end();
    }

    // Process received message with one of the loaded APIs
    function processMsg(request, body, response, path) {
      var validAPI = false;
      for (var i=0; i<apis.length; i++) {
        if (apis[i].processRequest(request, body, response, path)) {
          log.debug('NS_AS::onHTTPMessage::processMsg -> Cool, API accepted !');
          validAPI = true;
          break;
        }
      }
      if (!validAPI) {
        log.debug("NS_AS::onHTTPMessage --> messageType '" + path[1] + "' not recognized");
        return response.res(errorcodesAS.BAD_URL);
      }
    }

    if (request.method == 'PUT' || request.method == 'POST') {
      request.on('data', function(body) {
        processMsg(request, body, response, path);
      });
    } else {
      processMsg(request, '', response, path);
    }
  }
};

// Exports
exports.server = server;
