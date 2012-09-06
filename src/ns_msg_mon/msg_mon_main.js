/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_MSG_MON;
var log = require("../common/logger.js");

function NS_MSG_MON_main() {
}

NS_MSG_MON_main.prototype = {
  start: function() {
    var monitor = require('./msg_mon_server.js').monitor;
    this.server = new monitor();
    this.server.init();
    log.info("NS_MSG_MON server initialized");
  },

  stop: function(callback) {
    log.info("NS_MSG_MON server stopped");
    this.server.stop(callback);
  }
};

exports.NS_MSG_MON_main = NS_MSG_MON_main;