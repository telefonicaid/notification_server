/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_UA_WS;
var log = require("../common/logger.js").getLogger;

function NS_UA_WS_main() {
  this.servers = [];
}

NS_UA_WS_main.prototype = {
  start: function() {
    var server = require('./ws_server.js').server;
    // Start servers
    for(var a in config.ifaces) {
      this.servers[a] = new server(config.ifaces[a].iface, config.ifaces[a].port);
      this.servers[a].init();
    }
    log.info("NS_UA_WS server initialized");
  },

  stop: function() {
    log.info("NS_UA_WS server stopped");
    // TODO: Remove nodes from Mongo & close message queue
  }
};

exports.NS_UA_WS_main = NS_UA_WS_main;