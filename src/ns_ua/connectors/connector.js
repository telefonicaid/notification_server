/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mn = require("../../common/mobilenetwork.js"),
    log = require("../../common/logger.js"),
    connector_ws = require("./connector_ws.js"),
    connector_udp = require("./connector_udp.js");

function Connector() {
  this.nodesConnectors = {};
}

Connector.prototype = {
  /**
   * Create and return a connector object based on the data received
   */
  getConnector: function(data, connection, callback) {
    if (this.nodesConnectors[data.uatoken]) {
      return callback(null, this.nodesConnectors[data.uatoken]);
    } else if (data.interface && data.interface.ip && data.interface.port &&
       data.mobilenetwork && data.mobilenetwork.mcc && data.mobilenetwork.mnc) {
      mn.getNetwork(data.mobilenetwork.mcc, data.mobilenetwork.mnc, function(op) {
        var connector = null;
        if(op && op.wakeup) {
          log.debug("getConnector: UDP WakeUp server for " + op.operator + ": " + op.wakeup);
          connector = new connector_udp(data, connection);
          // No need to create a entry for UDP connections
          //this.nodesConnectors[data.uatoken] = connector;
          callback(null, connector);
        } else {
          if(op && op.operator) {
            log.debug("getConnector: No UDP WakeUp server found for " + op.operator);
          } else {
            log.debug("getConnector: No operator found for MCC=" +
              data.mobilenetwork.mcc + " and MNC=" + data.mobilenetwork.mnc);
          }
          connector = new connector_ws(data, connection);
          this.nodesConnectors[data.uatoken] = connector;
          callback(null, connector);
        }
      }.bind(this));
    } else {
      //Fallback
      var connector = new connector_ws(data, connection);
      this.nodesConnectors[data.uatoken] = connector;
      callback(null, connector);
    }
  },

  getConnectorForUAtoken: function(uatoken) {
    return this.nodesConnectors[uatoken];
  },

  getUAtokenForConnection: function(connection) {
    //FIXME
    return "blah blah";
  }
};

var connector = new Connector();
function getConnector() {
  return connector;
}

exports.getConnector = getConnector;
