/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js"),
    crypto = require("../common/cryptography.js"),
    msgBroker = require("../common/msgbroker.js"),
    dataStore = require("../common/datastore.js");

function monitor() {
}

monitor.prototype = {
  init: function() {
    msgBroker.on('brokerconnected', function() {
      log.info('MSG_mon::init --> MSG monitor server running');
      //We want a durable queue, that do not autodeletes on last closed connection, and
      // with HA activated (mirrored in each rabbit server)
      var args = {durable: true, autoDelete: false, arguments: {'x-ha-policy': 'all'}};
      msgBroker.subscribe("newMessages", args,  function(msg) {onNewMessage(msg);});
    });

    msgBroker.on('brokerdisconnected', function() {
      log.critical('ns_msg_monitor::init --> Broker DISCONNECTED!!');
    });

    // Connect to the message broker
    msgBroker.init();
  },

  stop: function(callback) {
    msgBroker.close();
    dataStore.close();
    callback(null);
  }
};

function onNewMessage(msg) {
  var json = {};
  try {
    json = JSON.parse(msg);
  } catch(e) {
    return log.error('MSG_mon::onNewMessage --> newMessages queue recived a bad JSON. Check');
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
  log.debug('MSG_mon::onNewMessage --> Mensaje desde la cola:' + JSON.stringify(json));
  dataStore.getApplication(json.watoken.toString(), onApplicationData, json);
}

function onApplicationData(appData, json) {
  if (!appData || !appData.node) {
    log.debug("No node or application detected. Message removed ! - " + JSON.stringify(json));
    dataStore.removeMessage(json._id);
    return log.debug("MSG_mon::onApplicationData --> No nodes, message removed and aborting");
  }

  log.debug("MSG_mon::onApplicationData --> Application data recovered: " + JSON.stringify(appData));
  appData.node.forEach(function (nodeData, i) {
    log.debug("MSG_mon::onApplicationData --> Notifying node: " + i + ": " + JSON.stringify(nodeData));
    dataStore.getNode(nodeData, onNodeData, json);
  });
}

function onNodeData(nodeData, json) {
  if (!nodeData) {
    return log.debug("No node info found!");
  }

  log.debug("MSG_mon::onNodeData --> Node data recovered: " + JSON.stringify(nodeData));
  log.debug("MSG_mon::onNodeData --> Notify into the messages queue of node " + nodeData.serverId + " # " + json._id);
  var body = {
    "messageId": json._id,
    "uatoken": nodeData._id,
    "data": nodeData.data,
    "payload": json
  };
  msgBroker.push(
    nodeData.serverId,
    body
  );
}

// Exports
exports.monitor = monitor;
