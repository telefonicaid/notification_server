/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js'),
    net = require('net'),
    fs = require('fs'),
    consts = require('../config.js').consts,
    dgram = require('dgram');

function server(ip, port, ssl) {
  this.ip = ip;
  this.port = port;
  this.ssl = ssl;
}

server.prototype = {
  // Constants
  PROTOCOL_UDPv4: 1,
  PROTOCOL_TCPv4: 2,

  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    log.info('Starting WakeUp server');

    // Create a new HTTP(S) Server
    if (this.ssl) {
      var options = {
        key: fs.readFileSync(consts.key),
        cert: fs.readFileSync(consts.cert)
      };
      this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
    } else {
      this.server = require('http').createServer(this.onHTTPMessage.bind(this));
    }
    this.server.listen(this.port, this.ip);
    log.info('NS_WakeUp::init --> HTTP' + (this.ssl ? 'S' : '') +
      ' push WakeUp server starting on ' + this.ip + ':' + this.port);
  },

  stop: function() {
    this.server.close(function() {
      log.info('NS_WakeUp::stop --> NS_WakeUp closed correctly');
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    var msg = '';
    log.notify('NS_WakeUp::onHTTPMessage --> Received request for ' + request.url);
    var WakeUpHost = this.parseURL(request.url).parsedURL.query;
    if (!WakeUpHost.ip || !WakeUpHost.port) {
      log.debug('NS_WakeUp::onHTTPMessage --> URL Format error - discarding');
      msg = '{"status": "ERROR", "reason": "URL Format Error"}';
      response.setHeader('Content-Type', 'text/plain');
      response.statusCode = 404;
      response.write(msg);
      return response.end();
    }

    // Check parameters
    if (!net.isIP(WakeUpHost.ip) ||     // Is a valid IP address
        isNaN(WakeUpHost.port) ||       // The port is a Number
        WakeUpHost.port < 0 || WakeUpHost.port > 65535  // The port has a valid value
    ) {
      log.debug('NS_WakeUp::onHTTPMessage --> Bad IP/Port');
      msg = '{"status": "ERROR", "reason": "Bad parameters. Bad IP/Port"}';
      response.setHeader('Content-Type', 'text/plain');
      response.statusCode = 404;
      response.write(msg);
      return response.end();
    }

    // Check protocolo
    var protocol = this.PROTOCOL_UDPv4;
    if (WakeUpHost.proto && WakeUpHost.proto == 'tcp') {
      protocol = this.PROTOCOL_TCPv4;
    }

    log.debug('NS_WakeUp::onHTTPMessage --> WakeUp IP = ' + WakeUpHost.ip + ':' + WakeUpHost.port + ' (protocol=' + protocol + ')');
    var message = new Buffer('NOTIFY ' + JSON.stringify(WakeUpHost));
    switch (protocol) {
      case this.PROTOCOL_TCPv4:
        // TCP Notification Message
        var tcp4Client = net.createConnection({host: WakeUpHost.ip, port: WakeUpHost.port},
            function() { //'connect' listener
          log.debug('TCP Client connected');
          tcp4Client.write(message);
          tcp4Client.end();
        });
        tcp4Client.on('data', function(data) {
          log.debug('TCP Data received: ' + data.toString());
        });
        tcp4Client.on('error', function(e) {
          log.debug('TCP Client error ' + JSON.stringify(e));
          log.notify('WakeUp TCP packet to ' + WakeUpHost.ip + ':' + WakeUpHost.port + ' - FAILED');

          response.statusCode = 404;
          response.setHeader('Content-Type', 'text/plain');
          response.write('{"status": "ERROR", "reason": "TCP Connection error"}');
          return response.end();
        });
        tcp4Client.on('end', function() {
          log.debug('TCP Client disconected');
          log.notify('WakeUp TCP packet succesfully sent to ' + WakeUpHost.ip + ':' + WakeUpHost.port);

          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/plain');
          response.write('{"status": "OK"}');
          return response.end();
        });
        break;
      case this.PROTOCOL_UDPv4:
        // UDP Notification Message
        var udp4Client = dgram.createSocket('udp4');
        udp4Client.send(
          message, 0, message.length,
          WakeUpHost.port, WakeUpHost.ip,
          function(err, bytes) {
            if (err) log.info('Error sending UDP Datagram to ' + WakeUpHost.ip + ':' + WakeUpHost.port);
            else log.notify('WakeUp Datagram sent to ' + WakeUpHost.ip + ':' + WakeUpHost.port);
            udp4Client.close();
          }
        );

        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/plain');
        response.write('{"status": "OK"}');
        return response.end();
        break;

      default:
        log.error('Protocol not supported !');
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/plain');
        response.write('{"status": "ERROR", "reason": "Protocol not supported"}');
        return response.end();
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

// Exports
exports.server = server;
