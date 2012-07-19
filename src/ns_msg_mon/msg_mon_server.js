/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js").getLogger;
var crypto = require("../common/cryptography.js").getCrypto();
var msgBroker = require("../common/msgbroker.js").getMsgBroker();
var dataStore = require("../common/datastore.js").getDataStore();


function monitor() {
}

monitor.prototype = {
  init: function() {
    // Connect to the message broker
    msgBroker.init(function() {
      log.info('MSG monitor server running');
      msgBroker.subscribe("newMessages", function(msg) { onNewMessage(msg); });
    });
  },
};

function onNewMessage(msg) {
  var json = JSON.parse(msg.body);
  log.debug('Mensaje recibido en la cola con id: ' + json.MsgId.toString());
  log.debug('Mensaje desde la cola ---' + JSON.stringify(json).toString());
  /*var msg = dataStore.getMessage(json.MsgId.toString(), function(message) {
    log.debug('Mensaje completo --> ' + message[0]);
  });*/
  dataStore.getApplication(json.watoken.toString(), onApplicationData, json);
}

function onApplicationData(appData, json) {
  log.debug("Application data recovered: " + JSON.stringify(appData));
  if (!appData.length) {
    return;
  }
  appData[0].node.forEach(function (nodeData, i) {
    log.debug("Notifying node: " + i + ": " + JSON.stringify(nodeData));
    dataStore.getNode(nodeData, onNodeData, json);
  });
}

function onNodeData(nodeData, json) {
  log.debug("Node data recovered: " + JSON.stringify(nodeData));
  if (!nodeData.length) {
    return;
  }
  log.debug("Notify into the messages queue of node " + nodeData[0].serverId + " # " + json.messageId);
  msgBroker.push(
    nodeData[0].serverId,
    { "messageId": json.messageId,
      "uatoken": nodeData[0].token,
      "data": nodeData[0].data,
      "payload": json
    },
    false
  );
}

// Exports
exports.monitor = monitor;
