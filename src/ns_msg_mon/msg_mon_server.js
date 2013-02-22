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
    dataStore = require('../common/datastore.js');

function monitor() {
  this.ready = false;
}

monitor.prototype = {
  init: function() {
    var self = this;
    msgBroker.on('brokerconnected', function() {
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

    msgBroker.on('brokerdisconnected', function() {
      self.ready = false;
      log.critical('ns_msg_monitor::init --> Broker DISCONNECTED!!');
    });

    // Connect to the message broker
    process.nextTick(function() {
      msgBroker.init();
    });

    // Check if we are alive
    setTimeout(function() {
      if (!self.ready)
        log.critical('30 seconds has passed and we are not ready, closing');
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
    return log.error('MSG_mon::onNewMessage --> newMessages queue recieved a bad JSON. Check');
  }
  log.debug('MSG_mon::onNewMessage --> Mensaje desde la cola:', json);

  //MsgType is either 0, 1, or 2.
  // 0 is "old" full notifications, with body, to be used by apps directly
  // 1 is Thialfy notifications, just have app and vs attributes
  // 2 is Desktop notifications, have a id (to be acked), a version and a body
  var msgType = -1;
  if (json.appToken) {
    msgType = 0;
  } else if (json.app && json.vs) {
    msgType = 1;
  } else if (json.body) {
    msgType = 2;
  }

  console.log("MSGType is= " + msgType);

  switch (msgType) {
    case 0:
      handleOldNotification(json);
      break;
    case 1:
      handleThialfiNotification(json);
      break;
    case 2:
      handleDesktopNotification(json);
      break;
    default:
      log.error('MSG_mon::onNewMessage --> Bad msgType: ', json);
      return;
  }
}

function handleOldNotification(json) {
  dataStore.getApplication(json.appToken, onApplicationData, json);
}

function handleThialfiNotification(json) {
  dataStore.getApplication(json.app, onApplicationData, json);
}

function handleDesktopNotification(json) {
  //TODO
  console.log('I\'m handling a Desktop notification');
}

function onApplicationData(error, appData, json) {
  if (error) {
    return log.error('MSG_mon::onApplicationData --> There was an error');
  }

  log.debug('MSG_mon::onApplicationData --> Application data recovered:', appData);
  appData.forEach(function(nodeData, i) {
    log.debug('MSG_mon::onApplicationData --> Notifying node: ' + i + ':', nodeData);
    onNodeData(nodeData, json);
  });
}

function onNodeData(nodeData, json) {
  if (!nodeData) {
    log.error('MSG_mon::onNodeData --> No node info, FIX YOUR BACKEND!');
    return;
  }

  // Is the node connected? AKA: is websocket?
  if (!nodeData.co) {
    log.debug('MSG_mon::onNodeData --> Node recovered but not connected, just delaying');
    return;
  }

  log.debug('MSG_mon::onNodeData --> Node connected:', nodeData);
  log.notify('MSG_mon::onNodeData --> Notify into the messages queue of node ' + nodeData.si + ' # ' + json.messageId);
  var body = {
    messageId: json.messageId,
    uaid: nodeData._id,
    dt: nodeData.dt,
    payload: json
  };
  msgBroker.push(nodeData.si, body);
}

exports.monitor = monitor;
