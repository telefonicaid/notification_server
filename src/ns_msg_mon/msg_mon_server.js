/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js'),
    msgBroker = require('../common/msgbroker.js'),
    dataStore = require('../common/datastore.js'),
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
  msgBroker.subscribe(
    'newMessages',
    args,
    broker,
    onNewMessage
  );
}


function monitor() {
  this.ready = false;
}

monitor.prototype = {
  init: function() {
    var self = this;

    msgBroker.once('brokerconnected', function() {
      log.info('MSG_mon::init --> MSG monitor server running');
      self.ready = true;
    });

    msgBroker.on('brokerconnected', subscribeQueues);

    msgBroker.once('brokerdisconnected', function() {
      self.ready = false;
      log.critical(log.messages.CRITICAL_MBDISCONNECTED, {
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
    msgBroker.on('queuedisconnected', subscribeQueues);

    // Connect to the message broker
    process.nextTick(function() {
      msgBroker.init();
    });

    // Check if we are alive
    this.readyTimeout = setTimeout(function() {
      if (!self.ready) {
        log.critical(log.messages.CRITICAL_NOTREADY);
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
    log.debug('MSG_mon::retryUDPnotACKed --> Starting retry procedure')
    dataStore.getUDPClientsAndUnACKedMessages(function(error, nodes) {
      if (error) {
        return;
      }

      if (!Array.isArray(nodes) || !nodes.length) {
        log.debug('MSG_mon::retryUDPnotACKed --> No pending messages for UDP clients');
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
    msgBroker.close();
    dataStore.close();
  }
};

function onNewMessage(msg) {
  var json = {};
  try {
    json = JSON.parse(msg);
  } catch (e) {
    return log.error(log.messages.ERROR_MONBADJSON);
  }
  log.debug('MSG_mon::onNewMessage --> Message from the queue:', json);

  if (!json.app || !json.vs) {
    return;
  }

  dataStore.getApplication(json.app, onApplicationData, json);
}

function onApplicationData(error, appData, json) {
  if (error) {
    return log.error(log.messages.ERROR_MONERROR);
  }

  log.debug('MSG_mon::onApplicationData --> Application data recovered:', appData);
  appData.forEach(function(nodeData, i) {
    log.debug('MSG_mon::onApplicationData --> Notifying node: ' + i + ':', nodeData);
    onNodeData(nodeData, json);
  });
}

function onNodeData(nodeData, json) {
  if (!nodeData || !nodeData.si || !nodeData._id) {
    log.error(log.messages.ERROR_BACKENDERROR, {
      "class": 'MSG_mon',
      "method": 'onNodeData',
      "extra": 'No enough info'
    });
    return;
  }

  // Is the node connected? AKA: is websocket?
  if (nodeData.co === connectionstate.DISCONNECTED) {
    log.debug('MSG_mon::onNodeData --> Node recovered but not connected, just delaying');
    return;
  }

  log.debug('MSG_mon::onNodeData --> Node connected:', nodeData);

  log.notify(log.messages.NOTIFY_INCOMING_TO, {
    uaid: nodeData._id,
    appToken: json.app,
    version: json.vs,
    mcc: (nodeData.dt && nodeData.dt.mobilenetwork && nodeData.dt.mobilenetwork.mcc) || 0,
    mnc: (nodeData.dt && nodeData.dt.mobilenetwork && nodeData.dt.mobilenetwork.mnc) || 0,
  });
  var body = {
    messageId: json.messageId,
    uaid: nodeData._id,
    dt: nodeData.dt,
    payload: json
  };
  msgBroker.push(nodeData.si, body);
}

exports.monitor = monitor;
