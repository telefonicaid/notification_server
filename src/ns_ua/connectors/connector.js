/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mn = require('../../common/mobilenetwork.js'),
    log = require('../../common/logger.js'),
    net = require('net'),
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
    //Is valid IP?
    var ip = data.wakeup_hostport && data.wakeup_hostport.ip &&
             net.isIP(data.wakeup_hostport.ip);
    //Is valid Port?
    var port = data.wakeup_hostport && data.wakeup_hostport.port &&
               (data.wakeup_hostport.port > 0) && (data.wakeup_hostport.port < 65535);
    //Is valid MCC?
    var mcc = data.mobilenetwork && data.mobilenetwork.mcc &&
              !isNaN(parseInt(data.mobilenetwork.mcc, 10));
    //Is valid MNC?
    var mnc = data.mobilenetwork && data.mobilenetwork.mnc &&
              !isNaN(parseInt(data.mobilenetwork.mnc, 10));
    if (this.nodesConnectors[data.uaid]) {
      return callback(null, this.nodesConnectors[data.uaid]);
    } else if (ip && port && mcc && mnc) {
      log.debug('getConnector --> Valid ip, port, mcc and mnc to search for wakeup');
      mn.getNetwork(data.mobilenetwork.mcc, data.mobilenetwork.mnc, function(error, op) {
        if (error) {
          log.error(log.messages.ERROR_CONNECTORERRORGETTINGOPERATOR, {
            "error": error
          });
          return;
        }
        if (!op || !op.wakeup) {
          log.debug('getConnector -->  No WakeUp server found for MCC=' +
                     data.mobilenetwork.mcc + ' and MNC=' + data.mobilenetwork.mnc);
          var connector = new connector_ws(data, connection);
          this.nodesConnectors[data.uaid] = connector;
          callback(null, connector);
          return;
        }
        var connector = null;
        log.debug('getConnector --> UDP WakeUp server for ' + op.operator + ': ' + op.wakeup);
        connector = new connector_udp(data, connection);
        this.nodesConnectors[data.uaid] = connector;
        callback(null, connector);
      }.bind(this));
    } else {
      //Fallback
      log.debug('getConnector --> getting a WebSocket connector');
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
