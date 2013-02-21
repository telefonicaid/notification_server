/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

function connector_websocket(data, connection) {
  this.data = data;
  this.connection = connection;
}

connector_websocket.prototype = {
  getType: function() {
    return 'WS';
  },

  getServer: function() {
    return process.serverId;
  },

  getConnection: function() {
    return this.connection;
  },

  getUAtoken: function() {
    return this.data.uaid;
  },

  getInterface: function() {
    return null;
  },

  getMobileNetwork: function() {
    return null;
  },

  getProtocol: function() {
    return 'ws';
  },

  canBeWakeup: function() {
    return false;
  },

  resetAutoclose: function() {
    return; // nothing to do on this connector
  },

  notify: function(msgList) {
    this.connection.sendUTF(JSON.stringify(msgList));
  }
};

module.exports = connector_websocket;
