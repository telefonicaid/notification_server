/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dgram = require('dgram');

function connector_udp(data, connection) {
  this.data = data;
  this.connection = connection;
}

connector_udp.prototype = {
  getType: function() {
    return 'UDP';
  },

  getServer: function() {
    return 'UDP';
  },

  getInterface: function() {
    return this.data.interface;
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
    if (this.autocloseTimeout)
      clearTimeout(this.autocloseTimeout);
    this.autocloseTimeout = setTimeout(function() {
      this.close();
    }.bind(this.connection), 10000);
  },

  getConnection: function() {
    return this.connection;
  },

  notify: function(msgList) {
    // Notify the handset with the associated Data
    log.error('Connector UDP: Notify to ' + this.data.interface.ip + ' not valid with this connector');
  }
};

module.exports = connector_udp;
