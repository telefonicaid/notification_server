/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('./logger.js');

function maintenance() {
  this.onmaintenance = false;
}

maintenance.prototype = {
  active: function() {
    log.debug("Setting under Maintenance");
    this.onmaintenance = true;
  },

  inactive: function() {
    log.debug("Removing under Maintenance");
    this.onmaintenance = false;
  },

  getStatus: function() {
    return this.onmaintenance;
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _maintenance = new maintenance();
function getMaintenance() {
  return _maintenance;
}

///////////////////////////////////////////
// Manage onmaintenance status with signals
///////////////////////////////////////////
process.on('SIGUSR1', function() {
  getMaintenance().active();
});
process.on('SIGUSR2', function() {
  getMaintenance().inactive();
});

module.exports = getMaintenance();
