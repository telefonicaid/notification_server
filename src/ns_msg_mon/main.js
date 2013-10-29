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


function subscribeQueues(broker) {
  //We want a durable queue, that do not autodeletes on last closed connection, and
  // with HA activated (mirrored in each rabbit server)
  var args = {
    durable: true,
    autoDelete: false,
    arguments: {
      'x-ha-policy': 'all'
    }
  };
  MsgBroker.subscribe(
    'newMessages',
    args,
    broker,
    onNewMessage
  );
}


function NS_Monitor() {
  this.ready = false;
}

NS_Monitor.prototype = {
  start: function() {
    Log.info('NS_MSG_MON server starting');
    var self = this;

    MsgBroker.once('ready', function() {
      Log.info('MSG_mon::init --> MSG monitor server running');
      self.ready = true;
    });

    MsgBroker.on('ready', subscribeQueues);

    MsgBroker.once('closed', function() {
      self.ready = false;
      Log.critical(Log.messages.CRITICAL_MBDISCONNECTED, {
        "class": 'ns_msg_monitor',
        "method": 'init'
      });
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
    MsgBroker.on('queuedisconnected', subscribeQueues);

    // Connect to the message broker
    process.nextTick(function() {
      MsgBroker.start();
      DataStore.start();
    });

    // Check if we are alive
    this.readyTimeout = setTimeout(function() {
      if (!self.ready) {
        Log.critical(Log.messages.CRITICAL_NOTREADY);
      }
    }, 30 * 1000); //Wait 30 seconds

    // Retry UDP messages for unACKed messages
    this.readyUDPTimeout = setTimeout(function() {
      self.retryUDPnotACKedInterval = setInterval(function retryUDPnotACKed() {
        self.retryUDPnotACKed();
      }, 31 * 1000); // Wait to be ready (31 seconds)
    }, config.retryTime);
  },

  retryUDPnotACKed: function() {
    Log.debug('MSG_mon::retryUDPnotACKed --> Starting retry procedure');
    DataStore.getUDPClientsAndUnACKedMessages(function(error, nodes) {
      if (error) {
        return;
      }

      if (!Array.isArray(nodes) || !nodes.length) {
        Log.debug('MSG_mon::retryUDPnotACKed --> No pending messages for UDP clients');
        return;
      }

      nodes.forEach(function(node) {
        onNodeData(node, {});
      });
    });
  },

  stop: function() {
    clearInterval(this.retryUDPnotACKedInterval);
    clearTimeout(this.readyTimeout);
    clearTimeout(this.readyUDPTimeout);
    MsgBroker.removeAllListeners();
    DataStore.removeAllListeners();
    MsgBroker.stop();
    DataStore.stop();
  }
};

function onNewMessage(msg) {
  Log.debug('NS_Monitor::onNewMessage --> Message received --', msg);
  if (!msg.app || !msg.vs) {
    Log.error('NS_Monitor::onNewMessage --> Not enough data', msg);
    return;
  }

  DataStore.getApplication(msg.app, onApplicationData, msg);
}

function onApplicationData(error, appData, json) {
  if (error) {
    Log.error(Log.messages.ERROR_MONERROR);
    return;
  }

  Log.debug('MSG_mon::onApplicationData --> Application data recovered:', appData);
  appData.forEach(function(nodeData, i) {
    Log.debug('MSG_mon::onApplicationData --> Notifying node: ' + i + ':', nodeData);
    onNodeData(nodeData, json);
  });
}

function onNodeData(nodeData, json) {
  if (!nodeData || !nodeData.si || !nodeData._id) {
    Log.error(Log.messages.ERROR_BACKENDERROR, {
      "class": 'MSG_mon',
      "method": 'onNodeData',
      "extra": 'No enough info'
    });
    return;
  }

  // Is the node connected? AKA: is websocket?
  if (nodeData.co === connectionstate.DISCONNECTED) {
    Log.debug('MSG_mon::onNodeData --> Node recovered but not connected, just delaying');
    return;
  }

  Log.debug('MSG_mon::onNodeData --> Node connected:', nodeData);

  Log.notify(Log.messages.NOTIFY_INCOMING_TO, {
    uaid: nodeData._id,
    appToken: json.app,
    version: json.vs,
    mcc: (nodeData.dt && nodeData.dt.mobilenetwork && nodeData.dt.mobilenetwork.mcc) || 0,
    mnc: (nodeData.dt && nodeData.dt.mobilenetwork && nodeData.dt.mobilenetwork.mnc) || 0
  });
  var body = {
    messageId: json.messageId,
    uaid: nodeData._id,
    dt: nodeData.dt,
    payload: json
  };
  MsgBroker.push(nodeData.si, body);
}

exports.NS_Monitor = NS_Monitor;