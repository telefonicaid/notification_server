/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var conn_ws = require("./connector_ws.js"),
    conn_udp = require("./connector_udp.js");

function connector_base() {
}

connector_base.prototype = {
  /**
   * Create and return a connector object based on the data received
   */
  getConnector: function(data,conn) {
    // TODO: Por ahora sólo devolvemos websocket connector
    // TODO: En funcion de la IP, deberemos decidir si ir por uno u otro conector
    var c = null;
    if(data.interface != null &&
        data.interface.ip != null && data.interface.port != null &&
       data.mobilenetwork != null &&
        data.mobilenetwork.mcc != null && data.mobilenetwork.mnc != null) {
      // TODO: Verify if the MCC and MNC is managed by us
      c = new conn_udp(data,conn);
    } else {
      c = new conn_ws(data,conn);
    }
    return c;
  }
};

var cb = new connector_base();
function getConnectorFactory() {
  return cb;
}

exports.getConnectorFactory = getConnectorFactory;
