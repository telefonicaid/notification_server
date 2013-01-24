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
    return this.data.uatoken;
  },

  getInterface: function() {
    return null;
  },

  getMobileNetwork: function() {
    return null;
  },

  getProtocol: function() {
    return 'WS';
  },

  notify: function(msgList) {
    this.connection.sendUTF(JSON.stringify(msgList));
  }
};

module.exports = connector_websocket;
