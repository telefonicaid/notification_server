/* jshint node: true */
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
    connector_udp = require('./connector_udp.js'),
    isIPInNetwork = require('../../common/helpers.js').isIPInNetwork;


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

    var connector = null;
    var self = this;

    if (ip && port && mcc && mnc) {
      log.debug('getConnector --> Valid ip, port, mcc and mnc to search for wakeup');
      mn.getNetwork(mcc, mnc, function(error, op) {
        if (error || !op) {
          log.error(log.messages.ERROR_CONNECTORERRORGETTINGOPERATOR, {
            "error": error
          });
          return callback(error);
        }
        // This is the only moment we can give a UDP connector
        var network = op.networks || [];
        log.debug('Checking if IP=' + ip + ' is on networks=' + networks);
        var inNetwork = isIPInNetwork(ip, networks);

        if (op.wakeup && inNetwork) {
          log.debug('getConnector --> UDP WakeUp server for ' + op.operator +
                    ': ' + op.wakeup);
          return self.getUDPconnector(data, connection, callback);
        } else {
          //Falback for WebSocket
          log.debug('getConnector::UDP --> Data is not accepted by the network' +
                    ' falling back to WebSocket');
          return self.getWSconnector(data, connection, callback);
        }
      });
    //Fallback for WebSocket.
    } else {
      return this.getWSconnector(data, connection, callback);
    }
  },

  getWSconnector: function(data, connection, callback) {
    if (this.nodesConnectors[data.uaid]) {
      this.nodesConnectors[data.uaid].getConnection().close();
    }
    log.debug('getConnector --> getting a WebSocket connector');
    connector = new connector_ws(data, connection);
    this.nodesConnectors[data.uaid] = connector;
    return callback(null, connector);
  },

  getUDPconnector: function(data, connection, callback) {
    if (this.nodesConnectors[data.uaid]) {
      this.nodesConnectors[data.uaid].getConnection().close();
    }
    connector = new connector_udp(data, connection);
    this.nodesConnectors[data.uaid] = connector;
    return callback(null, connector);
  },

  getConnectorForUAID: function(uaid) {
    return this.nodesConnectors[uaid];
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
