/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js");

function NS_UA_UDP_main() {
  this.servers = [];
}

NS_UA_UDP_main.prototype = {
  start: function() {
    var server = require('./udp_server.js').server;

    // Start server
    this.servers = new server();
    this.servers.init();

    log.info("NS_UA_UDP server starting");
  },

  stop: function(callback) {
    log.info("NS_UA_UDP server stopping");
    this.servers.stop(callback);
  }
};

exports.NS_UA_UDP_main = NS_UA_UDP_main;