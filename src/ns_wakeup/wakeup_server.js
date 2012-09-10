/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js"),
    http = require('http'),
    dgram = require('dgram');

function server(ip, port) {
  this.ip = ip;
  this.port = port;
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    log.info("Starting WakeUp server");

    // Create a new HTTP Server
    this.server = http.createServer(this.onHTTPMessage.bind(this));
    this.server.listen(this.port, this.ip);
    log.info('NS_WakeUp::init --> HTTP push WakeUp server starting on ' + this.ip + ":" + this.port);
  },

  stop: function(callback) {
    this.server.close(function() {
      log.info('NS_WakeUp::stop --> NS_WakeUp closed correctly');
      callback(null);
    });
  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    log.debug('NS_WakeUp::onHTTPMessage --> Received request for ' + request.url);
    var WakeUpHost = this.parseURL(request.url).parsedURL.query;
    if(!WakeUpHost.ip || !WakeUpHost.port) {
      log.debug('NS_WakeUp::onHTTPMessage --> URL Format error - discarding');
      response.write('{"status": "ERROR", "reason": "URL Format Error"}');
      return response.end();
    }

    log.debug('NS_WakeUp::onHTTPMessage --> WakeUp IP = ' + WakeUpHost.ip + ':' + WakeUpHost.port);

    // UDP Notification Message
    var message = new Buffer("NOTIFY " + JSON.stringify(WakeUpHost));
    var client = dgram.createSocket("udp4");
    client.send(
      message, 0, message.length,
      WakeUpHost.port, WakeUpHost.ip,
      function(err, bytes) {
        client.close();
      }
    );

    response.write('{"status": "OK"}');
    return response.end();
  },

  ///////////////////////
  // Auxiliar methods
  ///////////////////////
  parseURL: function(url) {
    var urlparser = require('url'),
        data = {};
    data.parsedURL = urlparser.parse(url,true);
    return data;
  }
};

// Exports
exports.server = server;
