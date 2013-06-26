/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js'),
    crypto = require('../common/cryptography.js'),
    msgBroker = require('../common/msgbroker.js'),
    dataStore = require('../common/datastore.js'),
    connectionstate = require('../common/constants.js').connectionstate;

function monitor() {
  this.ready = false;
}

monitor.prototype = {
  init: function() {
    var self = this;
    msgBroker.once('brokerconnected', function() {
      log.info('MSG_mon::init --> MSG monitor server running');
      self.ready = true;
      //We want a durable queue, that do not autodeletes on last closed connection, and
      // with HA activated (mirrored in each rabbit server)
      var args = {
        durable: true,
        autoDelete: false,
        arguments: {
          'x-ha-policy': 'all'
        }
      };
      msgBroker.subscribe('newMessages',
                          args,
                          function(msg) {
                            onNewMessage(msg);
                          }
      );
    });

    msgBroker.once('brokerdisconnected', function() {
      self.ready = false;
      log.critical(log.messages.CRITICAL_MBDISCONNECTED, {
        "class": 'ns_msg_monitor',
        "method": 'init'
      });
    });

    // Connect to the message broker
    process.nextTick(function() {
      msgBroker.init();
    });

    // Check if we are alive
    setTimeout(function() {
      if (!self.ready)
        log.critical(log.messages.CRITICAL_NOTREADY);
    }, 30 * 1000); //Wait 30 seconds
  },

  stop: function() {
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
