/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dgram = require('dgram'),
    log = require('../../common/logger.js');

function connector_udp(data, connection) {
  this.data = data;
  this.connection = connection;
  this.resetAutoclose();
}

connector_udp.prototype = {
  getType: function() {
    return 'UDP';
  },

  getServer: function() {
    return 'UDP';
  },

  getInterface: function() {
    return this.data.wakeup_hostport;
  },

  getMobileNetwork: function() {
    return this.data.mobilenetwork;
  },

  getProtocol: function() {
    return 'udp';
  },

  canBeWakeup: function() {
    return true;
  },

  resetAutoclose: function() {
    var con = this.connection;
    if (this.autocloseTimeout) {
      clearTimeout(this.autocloseTimeout);
    }
    this.autocloseTimeout = setTimeout(function() {
      con.drop(4774, "UDP Wakeup");
    }, 10000);
  },

  getConnection: function() {
    return this.connection;
  },

  notify: function(msgList) {
    // Notify the handset with the associated Data
    log.error(log.messages.ERROR_CONNECTORERRORNOTVALID, {
      "wakeupip": this.data.wakeup_hostport.ip
    });
  }
};

module.exports = connector_udp;
