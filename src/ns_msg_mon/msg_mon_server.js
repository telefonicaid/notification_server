/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js").getLogger;
var crypto = require("../common/cryptography.js").getCrypto();
var msgBroker = require("../common/msgbroker-amqp");
var dataStore = require("../common/datastore");

function monitor() {
}

monitor.prototype = {
  init: function() {
    // Connect to the message broker
    msgBroker.init(function() {
      log.info('MSG monitor server running');
      msgBroker.subscribe("newMessages", function(msg) { onNewMessage(msg); });
    });
  }
};

function onNewMessage(msg) {
  var json = {};
  try {
    json = JSON.parse(msg);
  } catch(e) {
    return;
  }
  log.debug('Mensaje recibido en la cola con id: ' + json._id.toString());
  log.debug('Mensaje desde la cola ---' + JSON.stringify(json).toString());
  dataStore.getApplication(json.watoken.toString(), onApplicationData, json);
}

function onApplicationData(appData, json) {
  log.debug("Application data recovered: " + JSON.stringify(appData));
  if (!appData.node) {
    return;
  }
  appData.node.forEach(function (nodeData, i) {
    log.debug("Notifying node: " + i + ": " + JSON.stringify(nodeData));
    dataStore.getNode(nodeData, onNodeData, json);
  });
}

function onNodeData(nodeData, json) {
  log.debug("Node data recovered: " + JSON.stringify(nodeData));
  if (!nodeData) {
    return;
  }
  log.debug("Notify into the messages queue of node " + nodeData.serverId + " # " + json._id);
  var body = { "messageId": json._id,
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
