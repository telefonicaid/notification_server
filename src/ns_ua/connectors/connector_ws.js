/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

function connector_websocket(data,conn) {
  this.data = data;
  this.connection = conn;
}

connector_websocket.prototype = {
  getType: function() {
    return "WS";
  },

  getConnection: function() {
    return this.connection;
  },

  notify: function(msgList) {
    this.connection.sendUTF(JSON.stringify(msgList));
  }
};

module.exports = connector_websocket;
