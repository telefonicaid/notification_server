/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_AS,
    log = require("../common/logger.js");

function NS_AS_main() {
  this.servers = [];
}

NS_AS_main.prototype = {
  start: function() {
    var server = require('./as_server.js').server;
    // Start servers
    for(var a in config.interfaces) {
      this.servers[a] = new server(config.interfaces[a].ip, config.interfaces[a].port);
      this.servers[a].init();
    }
    log.info("NS_AS::start --> server starting");
  },

  stop: function() {
    log.info("NS_AS::stop --> server stopping");
    (this.servers).forEach(function(server) {
      server.stop();
    });
  }
};

exports.NS_AS_main = NS_AS_main;