/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('./logger.js');

function maintance() {
  this.onmaintance = false;
}

maintance.prototype = {
  active: function() {
    log.debug("Setting under Maintance");
    this.onmaintance = true;
  },

  inactive: function() {
    log.debug("Removing under Maintance");
    this.onmaintance = false;
  },

  getStatus: function() {
    return this.onmaintance;
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _maintance = new maintance();
function getMaintance() {
  return _maintance;
}

///////////////////////////////////////////
// Manage onmaintance status with signals
///////////////////////////////////////////
process.on('SIGUSR1', function() {
  getMaintance().active();
});
process.on('SIGUSR2', function() {
  getMaintance().inactive();
});

module.exports = getMaintance();
