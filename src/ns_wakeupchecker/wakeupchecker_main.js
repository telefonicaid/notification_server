/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js');

function NS_WAKEUP_CHECKER_main() {
  this.server = null;
  this.controlledClose = false;
}

NS_WAKEUP_CHECKER_main.prototype = {
  start: function() {
    var server = require('./wakeupchecker_server.js').server;

    // Start server
    this.server = new server();
    this.server.init();

    log.info('NS_WAKEUP_CHECKER server starting');
  },

  stop: function() {
    if (this.controlledClose) {
      return;
    }
    this.controlledClose = true;
    log.info('NS_WAKEUP_CHECKER server stopping');
    this.server.stop();

    setTimeout(function() {
      process.exit(0);
    }, 10000);
  }
};

exports.NS_WAKEUP_CHECKER_main = NS_WAKEUP_CHECKER_main;
