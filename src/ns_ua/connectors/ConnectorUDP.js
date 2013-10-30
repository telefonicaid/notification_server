/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';

function ConnectorUDP(data, connection) {
  this.data = data;
  this.connection = connection;
  this.resetAutoclose();
}

ConnectorUDP.prototype = {
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
    this.connection.sendUTF(JSON.stringify(msgList));
  }
};

module.exports = ConnectorUDP;
