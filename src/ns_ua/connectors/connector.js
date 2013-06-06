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
    range_check = require('range_check');

var isIPInNetwork = function ipIsInNetwork(ip, networks) {
  //Adding private networks from https://tools.ietf.org/html/rfc1918
  //If networks are empty, we add RFC private networks.
  if (networks.length === 0) {
    networks.push("10.0.0.0/8");
    networks.push("172.16.0.0/12");
    networks.push("192.168.0.0/16");
  }
  log.debug('Checking if IP=' + ip + ' is on networks=' + networks);
  //If IP is in one of the network ranges, we think that you are in a
  //private network and can be woken up.
  return range_check.in_range(ip, networks);
};

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
      mn.getNetwork(data.mobilenetwork.mcc, data.mobilenetwork.mnc, function(error, op) {
        if (error) {
          log.error(log.messages.ERROR_CONNECTORERRORGETTINGOPERATOR, {
            "error": error
          });
          return callback(error);
        }
        // This is the only moment we can give a UDP connector
        if (op && op.wakeup &&
            isIPInNetwork(data.wakeup_hostport.ip,(op.networks || []) )) {
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
