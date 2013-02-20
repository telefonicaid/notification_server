/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mn = require('../../common/mobilenetwork.js'),
    log = require('../../common/logger.js'),
    connector_ws = require('./connector_ws.js'),
    connector_udp = require('./connector_udp.js');

function Connector() {
  this.nodesConnectors = {};
}

Connector.prototype = {
  /**
   * Create and return a connector object based on the data received
   */
  getConnector: function(data, connection, callback) {
    if (this.nodesConnectors[data.uaid]) {
      return callback(null, this.nodesConnectors[data.uaid]);
    } else if (data.interface && data.interface.ip && data.interface.port &&
       data.mobilenetwork && data.mobilenetwork.mcc && data.mobilenetwork.mnc) {
      mn.getNetwork(data.mobilenetwork.mcc, data.mobilenetwork.mnc, function(error, op) {
        if (error) {
          log.error('UDP::queue::onNewMessage --> Error getting the operator from the DB: ' + error);
          return;
        }
        if (!op || !op.wakeup) {
          log.debug('UDP::queue::onNewMessage --> No WakeUp server found for MCC=' +
                     data.mobilenetwork.mcc + ' and MNC=' + data.mobilenetwork.mnc);
          var connector = new connector_ws(data, connection);
          this.nodesConnectors[data.uaid] = connector;
          callback(null, connector);
          return;
        }
        var connector = null;
        log.debug('getConnector: UDP WakeUp server for ' + op.operator + ': ' + op.wakeup);
        connector = new connector_udp(data, connection);
        this.nodesConnectors[data.uaid] = connector;
        callback(null, connector);
      }.bind(this));
    } else {
      //Fallback
      var connector = new connector_ws(data, connection);
      this.nodesConnectors[data.uaid] = connector;
      callback(null, connector);
    }
  },

  getConnectorForUAID: function(uaid) {
    return this.nodesConnectors[uaid];
  },

  getUAtokenForConnection: function(connection) {
    Object.keys(this.nodesConnectors).forEach(function(elem) {
      if (this.nodesConnectors[elem] === connection);
      return this.nodesConnectors[elem];
    });
  },

  unregisterUAID: function(uaid) {
    if (this.nodesConnectors[uaid]) {
      this.nodesConnectors[uaid].getConnection().close();
      delete this.nodesConnectors[uaid];
    }
  }
};

var connector = new Connector();
function getConnector() {
  return connector;
}

exports.getConnector = getConnector;
