/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dataStore = require("../common/datastore.js").getDataStore();
var log = require("../common/logger.js").getLogger;

var ddbbsettings = require("../config.js").NS_AS.ddbbsettings;

function datamanager() {
  log.info("In-Memory data manager loaded.");

  // In-Memory NODE table storage
  this.nodesTable = {};
}

datamanager.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function (token, connector) {
    if(this.nodesTable[token]) {
      log.debug("Removing old node token " + token);
      delete(this.nodesTable[token]);
    }

    // Register a new node
    this.nodesTable[token] = connector;

    // Register in persistent datastore
    dataStore.registerNode(token);
  },

  /**
   * Gets a node connector (from memory)
   */
  getNode: function (token) {
    if(this.nodesTable[token]) {
      return this.nodesTable[token];
    }
    return false;
  },

  // TODO: Verify that the node exists before add the application
  /**
   * Register a new application
   */
  registerApplication: function (appToken, nodeToken) {
    // Store in persistent storage
    dataStore.registerApplication(appToken, nodeToken);
  },

  /**
   * Recover a message data and associated UAs
   */
  getMessage: function (id, callbackFunc) {
	  // Recover from the persistent storage
	  dataStore.getMessage(id, onMessage, {"messageId": id, "callbackFunction": callbackFunc});
  }
}

///////////////////////////////////////////
// Callbacks functions
///////////////////////////////////////////

function onMessage(message, message_info) {
  log.debug("Message payload: " + JSON.stringify(message[0].payload));
  message_info.message = message;
  // Recover list of UAs which has the application
  dataStore.getApplication(message[0].watoken, onApplicationData, message_info);
}

function onApplicationData(appData, message_info) {
  log.debug("Application data recovered: " + JSON.stringify(appData));
  message_info.nodeList = appData[0].node;
  message_info.callbackFunction(message_info);  
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var dm = new datamanager();
function getDataManager() {
  return dm;
}

exports.getDataManager = getDataManager;
