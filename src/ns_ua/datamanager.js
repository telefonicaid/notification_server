/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dataStore = require("../common/datastore.js")
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
	dataStore.getDataStore().registerNode(token);
  },

  /**
   * Gets a node connector
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
	dataStore.getDataStore().registerApplication(appToken, nodeToken);
  },
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var dm = new datamanager();
function getDataManager() {
  return dm;
}

exports.getDataManager = getDataManager;
