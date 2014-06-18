/* jshint node:true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var Log = require('../common/Logger.js'),
    MsgBroker = require('../common/MsgBroker.js'),
    DataStore = require('../common/DataStore.js'),
    config = require('../config.js').NS_Monitor,
    connectionstate = require('../common/constants.js').connectionstate;


function NS_Monitor() {
    this.closingCorrectly = false;
    this.dataStoreReady = false;
    this.msgBrokerReady = false;
    this.readyTimeout = undefined;
    this.readyUDPTimeout = undefined;
    this.retryUDPnotACKedInterval = undefined;
}

NS_Monitor.prototype.checkReady = function() {
    if (this.dataStoreReady && this.msgBrokerReady) {
        Log.debug('NS_Monitor::checkReady --> We are ready. Clearing any readyTimeout');
        clearTimeout(this.readyTimeout);
    } else {
        Log.debug('NS_Monitor::checkReady --> Not ready yet. dataStoreReady=' + this.dataStoreReady +
            ', msgBrokerReady=' + this.msgBrokerReady);
    }
    return this.dataStoreReady && this.msgBrokerReady;
};

NS_Monitor.prototype.start = function() {
    Log.info('NS_Monitor::start --> server starting');
    var self = this;

    MsgBroker.once('ready', function() {
        Log.info('NS_Monitor::start --> MsgBroker ready and connected');
        self.msgBrokerReady = true;
        self.checkReady();
    });

    MsgBroker.on('ready', this.subscribeQueues.bind(this));

    MsgBroker.once('closed', function() {
        self.msgBrokerReady = false;
        if (self.closingCorrectly) {
            Log.info('NS_AS::stop --> Closed MsgBroker');
            return;
        }
        Log.critical(Log.messages.CRITICAL_MBDISCONNECTED, {
            'class': 'NS_Monitor',
            'method': 'start'
        });
        self.stop();
    });

    DataStore.on('ready', function() {
        Log.info('NS_Monitor::start --> DataStore ready and connected');
        self.dataStoreReady = true;
        self.checkReady();
    });

    DataStore.on('closed', function() {
        if (self.closingCorrectly) {
            Log.info('NS_Monitor::start --> Closed DataStore');
            return;
        }
        Log.critical(Log.messages.CRITICAL_DBDISCONNECTED, {
            'class': 'NS_Monitor',
            'method': 'start'
        });
        self.dataStoreReady = false;
        self.stop();
    });


    //Hack. Once we have a disconnected queue, we must subscribe again for each
    //broker.
    //This happens on RabbitMQ as follows:
    // 1) We are connected to several brokers
    // 2) We are subscribed to the same queue on those brokers
    // 3) Master fails :(
    // 4) RabbitMQ promotes the eldest slave to be the master
    // 5) RabbitMQ disconnects all clients. Not a socket disconnection, but
    //    unbinds the connection to the subscribed queue.
    //
    // Hacky solution: once we have a disconnected queue (a socket error), we
    // subscribe again to the queue.
    // It's not beautiful (we should really unsubscribe all queues first), but works.
    // This *MIGHT* require OPS job if we have a long-long socket errors with queues.
    // (we might end up with gazillions (hundreds, really) callbacks on the same
    // socket for handling messages)
    MsgBroker.on('queuedisconnected', MsgBroker.reconnectQueues);

    // Connect to the message broker
    process.nextTick(function() {
        MsgBroker.start();
        DataStore.start();
    });

    //Check if we are alive
    this.readyTimeout = setTimeout(function() {
        Log.debug('NS_Monitor --> readyTimeout fired');
        if (!self.checkReady()) {
            Log.critical(Log.messages.CRITICAL_NOTREADY);
        }
    }, 30 * 1000); //Wait 30 seconds

    // Retry UDP messages for unACKed messages
    this.readyUDPTimeout = setTimeout(function() {
        self.retryUDPnotACKedInterval = setInterval(function retryUDPnotACKed() {
            self.retryUDPnotACKed();
        }, 31 * 1000); // Wait to be ready (31 seconds)
    }, config.retryTime);
};

NS_Monitor.prototype.stop = function(correctly) {
    this.closingCorrectly = correctly;
    Log.info('NS_Monitor::stop --> Closing NS_Monitor server');
    clearInterval(this.retryUDPnotACKedInterval);
    clearTimeout(this.readyTimeout);
    clearTimeout(this.readyUDPTimeout);

    //Closing connection with MsgBroker and DataStore
    MsgBroker.removeAllListeners();
    DataStore.removeAllListeners();
    MsgBroker.stop();
    DataStore.stop();
    setTimeout(function() {
        process.exit(0);
    }, 5000);
};

NS_Monitor.prototype.retryUDPnotACKed = function() {
    var self = this;
    Log.debug('NS_Monitor::retryUDPnotACKed --> Starting retry procedure');
    DataStore.getUDPClientsAndUnACKedMessages(function(error, nodes) {
        if (error) {
            return;
        }

        if (!Array.isArray(nodes) || !nodes.length) {
            Log.debug('NS_Monitor::retryUDPnotACKed --> No pending messages for UDP clients');
            return;
        }

        nodes.forEach(function(node) {
            self.onNodeData(node, {
                app: node.ch[0].app,
                vs: node.ch[0].vs
            });
        });
    });
};

NS_Monitor.prototype.onNodeData = function(nodeData, notif) {
    if (!nodeData || !nodeData.si || !nodeData._id || !nodeData.dt) {
        Log.error(Log.messages.ERROR_BACKENDERROR, {
            'class': 'NS_Monitor',
            'method': 'onNodeData',
            'extra': 'No enough info'
        });
        return;
    }

    // Is the node connected? AKA: is websocket?
    if (nodeData.co === connectionstate.DISCONNECTED) {
        Log.debug(
            'NS_Monitor::onNodeData --> Node recovered but not connected, just delaying'
        );
        return;
    }
    Log.debug('NS_Monitor::onNodeData --> Node connected:', nodeData);

    Log.notify(Log.messages.NOTIFY_INCOMING_TO, {
        uaid: nodeData._id,
        appToken: notif.app,
        version: notif.vs,
        mcc: (nodeData.dt.mobilenetwork && nodeData.dt.mobilenetwork.mcc) || 0,
        mnc: (nodeData.dt.mobilenetwork && nodeData.dt.mobilenetwork.mnc) || 0
    });
    var body = {
        uaid: nodeData._id,
        dt: nodeData.dt,
        notif: notif
    };
    MsgBroker.push(nodeData.si, body);
};

NS_Monitor.prototype.subscribeQueues = function(broker) {
    //We want a durable queue, that do not autodeletes on last closed connection, and
    // with HA activated (mirrored in each rabbit server)
    var args = {
        durable: true,
        autoDelete: false
    };
    MsgBroker.subscribe(
        'newMessages',
        args,
        broker,
        this.newMessage.bind(this)
    );
};


NS_Monitor.prototype.newMessage = function(msg) {
    Log.debug('NS_Monitor::newMessage --> Message received --', msg);
    if (!msg.app || !msg.ch || !msg.vs || !msg.no) {
        Log.error('NS_Monitor::newMessage --> Not enough data', msg);
        return;
    }
    DataStore.getNodeData(msg.no, (function(error, data) {
        this.onNodeData(data, msg);
    }).bind(this));
};

exports.NS_Monitor = NS_Monitor;
