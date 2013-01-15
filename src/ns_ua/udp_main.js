/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js");

function NS_UA_UDP_main() {
  this.server = null;
  this.controlledClose = false;
}

NS_UA_UDP_main.prototype = {
  start: function() {
    var server = require('./udp_server.js').server;

    // Start server
    this.server = new server();
    this.server.init();

    log.info("NS_UA_UDP server starting");
  },

  stop: function() {
    if (this.controlledClose) {
      return;
    }
    this.controlledClose = true;
    log.info("NS_UA_UDP server stopping");
    this.server.stop();

    setTimeout(function() {
      process.exit(0);
    }, 10000);
  }
};

exports.NS_UA_UDP_main = NS_UA_UDP_main;