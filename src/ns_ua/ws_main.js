/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_UA_WS,
    log = require('../common/logger.js');

function NS_UA_WS_main() {
  this.servers = [];
  this.controlledClose = false;
}

NS_UA_WS_main.prototype = {
  start: function() {
    var server = require('./ws_server.js').server;

    if (!config.interfaces) {
      return log.critical('NS_UA_WS interfaces not configured');
    }

    // Start servers
    for (var a in config.interfaces) {
      this.servers[a] = new server(
        config.interfaces[a].ip,
        config.interfaces[a].port,
        config.interfaces[a].ssl);
      this.servers[a].init();
    }
    log.info('NS_UA_WS server starting');
  },

  stop: function() {
    if (this.controlledClose) {
      return;
    }
    this.controlledClose = true;
    log.info('NS_UA_WS server stopping');
    this.servers.forEach(function(elem) {
      elem.stop();
    });

    setTimeout(function() {
      process.exit(0);
    }, 10000);
  }
};

exports.NS_UA_WS_main = NS_UA_WS_main;
