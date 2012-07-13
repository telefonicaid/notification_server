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
    log.info('MSG monitor server running');

    // Connect to the message broker
    msgBroker.init(function() {
      msgBroker.subscribe("newMessages", function(msg) { onNewMessage(msg); });
    });
  },
};

function onNewMessage(msg) {
  log.debug('Mensaje recibido en la --' + msg.body.toString());
  //dataStore.getApplication(watoken, onApplicationData, id);
}

function onApplicationData(appData, messageId) {
  log.debug("Application data recovered: " + JSON.stringify(appData));
  if (!appData.length) {
    return;
  }
  appData[0].node.forEach(function (nodeData, i) {
    log.debug("Notifying node: " + i + ": " + JSON.stringify(nodeData));
    dataStore.getNode(nodeData, onNodeData, messageId);
  });
}

function onNodeData(nodeData, messageId) {
  log.debug("Node data recovered: " + JSON.stringify(nodeData));
  if (!nodeData.length) {
    return;
  }
  log.debug("Notify into the messages queue of node " + nodeData[0].serverId + " # " + messageId);
  msgBroker.push(
    nodeData[0].serverId,
    { "messageId": messageId,
      "uatoken": nodeData[0].token,
      "data": nodeData[0].data
    },
    false
  );
}

// Exports
exports.monitor = monitor;
