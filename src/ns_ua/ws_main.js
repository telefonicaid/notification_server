/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_UA_WS,
    log = require("../common/logger.js");

function NS_UA_WS_main() {
  this.servers = [];
}

NS_UA_WS_main.prototype = {
  start: function() {
    var server = require('./ws_server.js').server;

    if (!config.interfaces) {
      return log.critical("NS_UA_WS interfaces not configured");
    }

    // Start servers
    for(var a in config.interfaces) {
      this.servers[a] = new server(config.interfaces[a].ip, config.interfaces[a].port);
      this.servers[a].init();
    }
    log.info("NS_UA_WS server starting");
  },

  stop: function() {
    log.info("NS_UA_WS server stopping");
    for (var i = this.servers.length - 1; i >= 0; i--) {
      this.servers[i].stop();
    }
  }
};

exports.NS_UA_WS_main = NS_UA_WS_main;