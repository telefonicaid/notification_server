/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js").getLogger;

function NS_UA_UDP_main() {
  this.servers = [];
}

NS_UA_UDP_main.prototype = {
  start: function() {
    var server = require('./udp_server.js').server;

    // Start server
    this.servers = new server();
    this.servers.init();

    log.info("NS_UA_UDP server initialized");
  },

  stop: function() {
    log.info("NS_UA_UDP server stopped");
  }
};

exports.NS_UA_UDP_main = NS_UA_UDP_main;