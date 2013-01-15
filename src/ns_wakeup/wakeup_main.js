/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_WakeUp,
    log = require("../common/logger.js");

function NS_WakeUp_main() {
  this.servers = [];
  this.controlledClose = false;
}

NS_WakeUp_main.prototype = {
  start: function() {
    var server = require('./wakeup_server.js').server;

    // Start servers
    for(var a in config.interfaces) {
      this.servers[a] = new server(
        config.interfaces[a].ip,
        config.interfaces[a].port,
        config.interfaces[a].ssl);
      this.servers[a].init();
    }

    log.info("NS_WakeUp server starting");
  },

  stop: function() {
    if (this.controlledClose) {
      return;
    }
    this.controlledClose = true;
    log.info("NS_WakeUp server stopping");
    this.servers.forEach(function(server) {
      server.stop();
    });

    setTimeout(function() {
      process.exit(0);
    }, 10000);

  }
};

exports.NS_WakeUp_main = NS_WakeUp_main;