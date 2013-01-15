/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_MSG_MON,
    log = require("../common/logger.js");

function NS_MSG_MON_main() {
  this.controlledClose = false;
}

NS_MSG_MON_main.prototype = {
  start: function() {
    var monitor = require('./msg_mon_server.js').monitor;
    this.server = new monitor();
    this.server.init();
    log.info("NS_MSG_MON server starting");
  },

  stop: function() {
    if (this.controlledClose) {
      return;
    }
    this.controlledClose = true;
    log.info("NS_MSG_MON server stopping");
    this.server.stop();

    setTimeout(function() {
      process.exit(0);
    }, 10000);
  }
};

exports.NS_MSG_MON_main = NS_MSG_MON_main;