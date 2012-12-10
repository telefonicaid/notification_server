/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js"),
    crypto = require("../common/cryptography.js"),
    msgBroker = require("../common/msgbroker.js"),
    dataStore = require("../common/datastore.js");

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
      msgBroker.subscribe("newMessages",
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
    }, 30*1000); //Wait 30 seconds
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
  } catch(e) {
    return log.error('MSG_mon::onNewMessage --> newMessages queue recieved a bad JSON. Check');
  }

  /**
   * Messages are formed like this:
   * { "messageId": "UUID",
   *   "uatoken": "UATOKEN",
   *   "data": {
   *     "fillmein"
   *   },
   *   "payload": {
   *      "_id": "internalMongoDBidentifier",
   *      "watoken": "WATOKEN",
   *      "payload": {
   *        //Standard notification
   *        "id",
   *        "message": "original Payload",
   *        "ttl",
   *        "timestamp",
   *        "priority",
   *        "messageId": "equals the first messageId",
   *        "url": URL_TO_PUSH
   *     }
   *   }
   * }
   */

  if (!json.watoken) {
    return log.error('MSG_mon::onNewMessage --> newMessages has a message without WAtoken attribute');
  }
  log.debug('MSG_mon::onNewMessage --> Mensaje desde la cola:', json);
  dataStore.getApplication(json.watoken.toString(), onApplicationData, json);
}

function onApplicationData(error, appData, json) {
  if (error) {
    return log.error("MSG_mon::onApplicationData --> There was an error");
  }

  log.debug("MSG_mon::onApplicationData --> Application data recovered:", appData);
  appData.forEach(function (nodeData, i) {
    log.debug("MSG_mon::onApplicationData --> Notifying node: " + i + ":", nodeData);
    onNodeData(nodeData, json);
  });
}

function onNodeData(nodeData, json) {
  if (!nodeData) {
    log.error("MSG_mon::onNodeData --> No node info, FIX YOUR BACKEND!");
    return;
  }

  // Is the node connected? AKA: is websocket?
  if (!nodeData.co) {
    log.debug("MSG_mon::onNodeData --> Node recovered but not connected, just delaying");
    return;
  }

  log.debug("MSG_mon::onNodeData --> Node connected:", nodeData);
  log.notify("MSG_mon::onNodeData --> Notify into the messages queue of node " + nodeData.si + " # " + json._id);
  var body = {
    messageId: json._id,
    uatoken: nodeData._id,
    dt: nodeData.dt,
    payload: json
  };
  msgBroker.push(nodeData.si, body);
}

exports.monitor = monitor;
