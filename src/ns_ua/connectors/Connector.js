/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var mn = require('../../common/MobileNetwork.js'),
    Log = require('../../common/Logger.js'),
    net = require('net'),
    ConnectorWebSocket = require('./ConnectorWebSocket.js'),
    ConnectorUDP = require('./ConnectorUDP.js'),
    isIPInNetwork = require('../../common/Helpers.js').isIPInNetwork;


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
        var mcc = data.mobilenetwork && data.mobilenetwork.mcc;
        //Is valid MNC?
        var mnc = data.mobilenetwork && data.mobilenetwork.mnc;
        //NetID (if present)
        var netid = data.mobilenetwork && data.mobilenetwork.netid;

        var self = this;

        if (ip && port && mcc && mnc && !isNaN(parseInt(mcc)) && !isNaN(parseInt(mnc))) {
            Log.debug('getConnector --> Valid ip, port, mcc and mnc to search for wakeup');
            mn.getNetwork(mcc, mnc, netid, function(error, op) {
                if (error) {
                    Log.error(Log.messages.ERROR_CONNECTORERRORGETTINGOPERATOR, {
                        'error': error
                    });
                    callback(error);
                    return;
                }

                // This is the only moment we can give a UDP connector
                var network = (op && op.range) || [];
                Log.debug('Checking if IP=' + data.wakeup_hostport.ip + ' is on networks=' + network);
                var inNetwork = isIPInNetwork(data.wakeup_hostport.ip, network);

                if (op && op.wakeup && !op.offline && inNetwork) {
                    Log.debug('getConnector --> UDP WakeUp server through ' + op.wakeup.name +
                        '. MCC-MNC: ' + op.mccmnc + " - netID: " + op.netid);
                    self.getUDPconnector(data, connection, callback);
                } else {
                    //Falback for WebSocket
                    Log.debug('getConnector::UDP --> Data is not accepted by the network' +
                        ' falling back to WebSocket');
                    Log.debug('getConnector::UDP --> Local server is ' +
                        ((op && !op.offline) ? 'online' : 'offline'));
                    if (!inNetwork) {
                        Log.debug('getConnector::UDP --> Host is out of the allowed networks')
                    }
                    self.getWSconnector(data, connection, callback);
                }
            });
            //Fallback for WebSocket.
        } else {
            this.getWSconnector(data, connection, callback);
        }
    },

    getWSconnector: function(data, connection, callback) {
        if (this.nodesConnectors[data.uaid]) {
            var oldConnection = this.nodesConnectors[data.uaid].getConnection();
            oldConnection.replacedByNewConnection = true;
            oldConnection.close();
        }
        Log.debug('getConnector --> getting a WebSocket connector');
        var connector = new ConnectorWebSocket(data, connection);
        this.nodesConnectors[data.uaid] = connector;
        return callback(null, connector);
    },

    getUDPconnector: function(data, connection, callback) {
        if (this.nodesConnectors[data.uaid]) {
            this.nodesConnectors[data.uaid].getConnection().close();
        }
        var connector = new ConnectorUDP(data, connection);
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
