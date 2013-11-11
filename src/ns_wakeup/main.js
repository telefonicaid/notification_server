/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';

var Log = require('../common/Logger.js'),
    net = require('net'),
    fs = require('fs'),
    config = require('../config.js').NS_WakeUp,
    cluster = require('cluster'),
    consts = require('../config.js').consts,
    dgram = require('dgram'),
    Pages = require('../common/Pages.js'),
    Maintenance = require('../common/Maintenance.js'),
    Helpers = require('../common/Helpers.js');

function NS_WakeUp(ip, port, ssl) {
  this.ip = ip;
  this.port = port;
  this.ssl = ssl;
}

NS_WakeUp.prototype = {
  // Constants
  PROTOCOL_UDPv4: 1,
  PROTOCOL_TCPv4: 2,

  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  start: function() {

    if (!config.interface) {
      Log.critical(Log.messages.CRITICAL_WSINTERFACESNOTCONFIGURED);
      return;
    }

    this.ip = config.interface.ip;
    this.port = config.interface.port;
    this.ssl = config.interface.ssl;
    Log.info('NS_WakeUp::start --> server starting');

    if (cluster.isMaster) {
      // Fork workers.
      for (var i = 0; i < config.numProcesses; i++) {
        cluster.fork();
      }

      cluster.on('exit', function(worker, code) {
        if (code !== 0) {
          Log.error(Log.messages.ERROR_WORKERERROR, {
            'pid': worker.process.pid,
            'code': code
          });
        } else {
          Log.info('NS_WakeUp::start --> worker ' + worker.process.pid + ' exit');
        }
      });
    } else {
      Log.info('NS_WakeUp::start --> Starting WakeUp server');

      // Create a new HTTP(S) Server
      if (this.ssl) {
        var options = {
          ca: Helpers.getCaChannel(),
          key: fs.readFileSync(consts.key),
          cert: fs.readFileSync(consts.cert)
        };
        this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
      } else {
        this.server = require('http').createServer(this.onHTTPMessage.bind(this));
      }
      this.server.listen(this.port, this.ip);
      Log.info('NS_WakeUp::start --> HTTP' + (this.ssl ? 'S' : '') +
        ' push WakeUp server starting on ' + this.ip + ':' + this.port);
    }
  },

  stop: function() {
    if (cluster.isMaster) {
      setTimeout(function() {
        process.exit(0);
      }, 10000);
      return;
    }
    this.server.close(function() {
      Log.info('NS_WakeUp::stop --> NS_WakeUp closed correctly');
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    var msg = '';
    Log.notify(Log.messages.NOTIFY_RECEIVEDREQUESTFORURL, {
      url: request.url
    });

    if (request.url === '/about') {
      if (consts.PREPRODUCTION_MODE) {
        var text = '';
        try {
          var p = new Pages();
          p.setTemplate('views/about.tmpl');
          text = p.render(function(t) {
            switch (t) {
            case '{{GIT_VERSION}}':
              return require('fs').readFileSync('version.info');
            case '{{MODULE_NAME}}':
              return 'WakeUp UDP/TCP Server';
            default:
              return '';
            }
          });
        } catch(e) {
          text = 'No version.info file';
        }
        response.setHeader('Content-Type', 'text/html');
        response.statusCode = 200;
        response.write(text);
      } else {
        response.statusCode = 405;
      }
      response.end();
      return;
    } else if (request.url === '/status') {
      // Return status mode to be used by load-balancers
      response.setHeader('Content-Type', 'text/html');
      if (Maintenance.getStatus()) {
        response.statusCode = 503;
        response.write('Under Maintenance');
      } else {
        response.statusCode = 200;
        response.write('OK');
      }
      response.end();
      return;
    }

    var WakeUpHost = this.parseURL(request.url).parsedURL.query;
    if (!WakeUpHost.ip || !WakeUpHost.port) {
      Log.debug('NS_WakeUp::onHTTPMessage --> URL Format error - discarding');
      msg = '{"status": "ERROR", "reason": "URL Format Error"}';
      response.setHeader('Content-Type', 'text/plain');
      response.statusCode = 404;
      response.write(msg);
      response.end();
      return;
    }

    // Check parameters
    if (!net.isIP(WakeUpHost.ip) ||     // Is a valid IP address
      isNaN(WakeUpHost.port) ||       // The port is a Number
      WakeUpHost.port < 0 || WakeUpHost.port > 65535  // The port has a valid value
      ) {
      Log.debug('NS_WakeUp::onHTTPMessage --> Bad IP/Port');
      msg = '{"status": "ERROR", "reason": "Bad parameters. Bad IP/Port"}';
      response.setHeader('Content-Type', 'text/plain');
      response.statusCode = 404;
      response.write(msg);
      response.end();
      return;
    }

    // Check protocolo
    var protocol = this.PROTOCOL_UDPv4;
    if (WakeUpHost.proto && WakeUpHost.proto === 'tcp') {
      protocol = this.PROTOCOL_TCPv4;
    }

    Log.debug('NS_WakeUp::onHTTPMessage --> WakeUp IP = ' + WakeUpHost.ip + ':' + WakeUpHost.port + ' (protocol=' + protocol + ')');
    var message = new Buffer('NOTIFY ' + JSON.stringify(WakeUpHost));
    switch (protocol) {
    case this.PROTOCOL_TCPv4:
      // TCP Notification Message
      var tcp4Client = net.createConnection({host: WakeUpHost.ip, port: WakeUpHost.port},
        function() { //'connect' listener
          Log.debug('TCP Client connected');
          tcp4Client.write(message);
          tcp4Client.end();
        }
      );
      tcp4Client.on('data', function(data) {
        Log.debug('TCP Data received: ' + data.toString());
      });
      tcp4Client.on('error', function(e) {
        Log.debug('TCP Client error ' + JSON.stringify(e));
        Log.notify(Log.messages.NOTIFY_WAKEUPPACKAGEFAILED, {
          ip: WakeUpHost.ip,
          port: WakeUpHost.port
        });

        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/plain');
        response.write('{"status": "ERROR", "reason": "TCP Connection error"}');
        response.end();
      });
      tcp4Client.on('end', function() {
        Log.debug('TCP Client disconected');
        Log.notify(Log.messages.NOTIFY_WAKEUPPACKAGEOK, {
          ip: WakeUpHost.ip,
          port: WakeUpHost.port
        });

        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/plain');
        response.write('{"status": "OK"}');
        response.end();
      });
      break;
    case this.PROTOCOL_UDPv4:
      // UDP Notification Message
      var udp4Client = dgram.createSocket('udp4');
      udp4Client.send(
        message, 0, message.length,
        WakeUpHost.port, WakeUpHost.ip,
        function(err) {
          if (err) {
            Log.info('Error sending UDP Datagram to ' + WakeUpHost.ip + ':' + WakeUpHost.port);
          }
          else {
            Log.notify(Log.messages.NOTIFY_WAKEUPPACKAGEUDPDGRAMSENT, {
              ip: WakeUpHost.ip,
              port: WakeUpHost.port
            });
            udp4Client.close();
          }
        });

      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/plain');
      response.write('{"status": "OK"}');
      response.end();
      break;

    default:
      Log.error(Log.messages.ERROR_WAKEUPPROTOCOLNOTSUPPORTED);
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/plain');
      response.write('{"status": "ERROR", "reason": "Protocol not supported"}');
      response.end();
    }
  },

  ///////////////////////
  // Auxiliar methods
  ///////////////////////
  parseURL: function(url) {
    var urlparser = require('url'),
      data = {};
    data.parsedURL = urlparser.parse(url, true);
    return data;
  }
};

exports.NS_WakeUp = NS_WakeUp;
