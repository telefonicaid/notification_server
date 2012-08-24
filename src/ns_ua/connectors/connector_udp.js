/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dgram = require('dgram');

function connector_udp(data,conn) {
  this.data = data;
  this.connection = conn;
  this.connection.close();
}

connector_udp.prototype = {
  getType: function() {
    return "UDP";
  },

  getInterface: function() {
    return this.data.interface;
  },

  getConnection: function() {
    return this.connection;
  },

  notify: function(msgList) {
    // Notify the hanset with the associated Data
    console.error("Connector UDP: Notify to " + this.data.interface.ip + " not valid on this server");
  }
};

module.exports = connector_udp;
