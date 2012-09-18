/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */
var mn = require('../../common/mobilenetwork.js'),
    log = require('../../common/logger.js'),
    conn_ws = require('./connector_ws.js'),
    conn_udp = require('./connector_udp.js');

function connector_base() {}

connector_base.prototype = {
  /**
   * Create and return a connector object based on the data received
   */
  getConnector: function(data, conn, callback) {
    if (data.interface && data.interface.ip && data.interface.port && data.mobilenetwork && data.mobilenetwork.mcc && data.mobilenetwork.mnc) {
      mn.getNetwork(data.mobilenetwork.mcc, data.mobilenetwork.mnc, function(op) {
        if (op && op.wakeup) {
          log.debug('getConnector: UDP WakeUp server for ' + op.operator + ': ' + op.wakeup);
          callback(null, new conn_udp(data, conn));
        } else {
          if (op && op.operator) {
            log.debug('getConnector: No UDP WakeUp server found for ' + op.operator);
          } else {
            log.debug('getConnector: No operator found for MCC=' + data.mobilenetwork.mcc + ' and MNC=' + data.mobilenetwork.mnc);
          }
          callback(null, new conn_ws(data, conn));
        }
      }.bind(this));
    } else {
      callback(null, new conn_ws(data, conn));
    }
  }
};

var cb = new connector_base();

function getConnectorFactory() {
  return cb;
}

exports.getConnectorFactory = getConnectorFactory;
