/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mb = require("../../common/mobilenetwork.js"),
    log = require("../../common/logger.js"),
    conn_ws = require("./connector_ws.js"),
    conn_udp = require("./connector_udp.js");

function connector_base() {
}

connector_base.prototype = {
  /**
   * Create and return a connector object based on the data received
   */
  getConnector: function(data,conn,callback) {
    if(data.interface != null &&
       data.interface.ip != null && data.interface.port != null &&
       data.mobilenetwork != null &&
       data.mobilenetwork.mcc != null && data.mobilenetwork.mnc != null) {

      mb.getNetwork(data.mobilenetwork.mcc, data.mobilenetwork.mnc, function(op) {
        if(op != {} && op.wakeup != null) {
          log.debug("getConnector: UDP WakeUp server for " + op.operator + ": " + op.wakeup);
          callback(null,new conn_udp(data,conn));
        } else {
          if(op.operator == null) {
            log.debug("getConnector: No operator found for MCC=" +
              data.mobilenetwork.mcc + " and MNC=" + data.mobilenetwork.mnc);
          } else {
            log.debug("getConnector: No UDP WakeUp server found for " + op.operator);
          }
          callback(null,new conn_ws(data,conn));
        }
      }.bind(this));
    } else {
      callback(null,new conn_ws(data,conn));
    }
  }
};

var cb = new connector_base();
function getConnectorFactory() {
  return cb;
}

exports.getConnectorFactory = getConnectorFactory;
