/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_AS;
var log = require("../common/logger.js").getLogger;

function NS_AS_main() {
  this.servers = [];
}

NS_AS_main.prototype = {
  start: function() {
    var server = require('./as_server.js').server;
    // Start servers
    for(var a in config.interfaces) {
      this.servers[a] = new server(config.interfaces[a].interface, config.interfaces[a].port);
      this.servers[a].init();
    }
    log.info("NS_AS server initialized");
  },

  stop: function() {
    log.info("NS_AS server stopped");
    // TODO
  }
};

exports.NS_AS_main = NS_AS_main;