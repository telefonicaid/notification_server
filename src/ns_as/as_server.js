/* jshint node: true */
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
    cluster = require('cluster'),
    uuid = require('node-uuid'),
    crypto = require('../common/cryptography'),
    msgBroker = require('../common/msgbroker'),
    dataStore = require('../common/datastore'),
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesAS = require('../common/constants').errorcodes.AS,
    pages = require('../common/pages.js'),
    maintenance = require('../common/maintenance.js'),
    helpers = require('../common/helpers.js'),
    simplepush = require('./apis/SimplePushAPI_v1');

function server(ip, port, ssl) {
  this.ip = ip;
  this.port = port;
  this.ssl = ssl;
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
      // Create a new HTTP(S) Server
      if (this.ssl) {
        var options = {
          ca: helpers.getCaChannel(),
          key: fs.readFileSync(consts.key),
          cert: fs.readFileSync(consts.cert),
          requestCert: false,
          rejectUnauthorized: false
        };
        this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
      } else {
        this.server = require('http').createServer(this.onHTTPMessage.bind(this));
      }
      this.server.listen(this.port, this.ip);
      log.info('NS_AS::init --> HTTP' + (this.ssl ? 'S' : '') +
               ' push AS server starting on ' + this.ip + ':' + this.port);

      var self = this;
      // Events from msgBroker
      msgBroker.once('brokerconnected', function() {
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
      this.readyTimeout = setTimeout(function() {
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

    // For workers, clean timeouts or intervals
    clearTimeout(this.readyTimeout);

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
    //log.debug('[onHTTPMessage auth]', request.connection.authorizationError);
    //log.debug('[onHTTPMessage received certificate]',
    //request.connection.getPeerCertificate());

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
      var body = '';
      request.on('data', function(data) {
        body += data;
        // Max. payload: "version=9007199254740992" => lenght: 24
        if (body.length > 25) {
          request.tooBig = true;
          request.emit('end');
          log.debug('NS_AS::onHTTPMessage --> Message rejected, too long for this API');
          return response.res(errorcodesAS.BAD_MESSAGE_BODY_TOO_BIG);
        }
      });
      request.on('end', function() {
        if (request.tooBig) {
            return;
        }
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
            var text = p.render(function(t) {
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
        if (maintenance.getStatus()) {
          response.statusCode = 503;
          response.write('Under Maintenance');
        } else {
          response.statusCode = 200;
          response.write('OK');
        }
        response.end();
        break;

      default:
        log.debug("NS_AS::onHTTPMessage --> messageType '" + path[1] + "' not recognized");
        return response.res(errorcodesAS.BAD_URL);
    }
  }
};

// Exports
exports.server = server;
