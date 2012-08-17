/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dataStore = require("../common/datastore");
var log = require("../common/logger.js").getLogger;

var ddbbsettings = require("../config.js").NS_AS.ddbbsettings;

function datamanager() {
  log.info("dataManager --> In-Memory data manager loaded.");

  // In-Memory NODE table storage
  this.nodesTable = {};
  this.nodesConnections = {};
}

datamanager.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function (token, connector, connection, callback) {
    if(this.nodesTable[token]) {
      log.debug("dataManager::registerNode --> Removing old node token " + token);
      delete(this.nodesTable[token]);
      //TODO: Delete old connection for this token
    }

    if(connector.getType() == "UDP") {
      log.debug("dataManager::registerNode --> Registraton of the node into datastore (UDP Connector)");

      // No persitent object required on this server (ie., UDP connectors)
      // Register in persistent datastore
      dataStore.registerNode(
        token,                                        // UAToken
        "UDP",                                        // Queue name
        { "interface": connector.getInterface() },    // UDP Interface data
        callback
      );
    } else {
      log.debug("dataManager::registerNode --> Registraton of the connector into memory and node into datastore");

      // Register a new node
      this.nodesTable[token] = connector;
      this.nodesConnections[connection] = token;

      // Register in persistent datastore
      dataStore.registerNode(
        token,                                        // UAToken
        process.serverId,                             // Queue name (server ID)
        {},                                            // No extra data
        callback
      );
    }
  },

  /**
   * Unregisters a Node from the DDBB and memory
   */
  unregisterNode: function(connection) {
    log.debug('dataManager::unregisterNode --> Going to unregister a node');
    var token = this.nodesConnections[connection];
    if(token) {
      log.debug("dataManager::unregisterNode --> Removing disconnected node token " + token);
      delete(this.nodesTable[token]);
      delete(this.nodesConnections[connection]);
      dataStore.unregisterNode(
        token,
        function(ok) {
          if (ok) {
            log.debug('dataManager::unregisterNode --> Deleted from DDBB');
          } else {
            log.info('dataManager::unregisterNode --> There was a problem deleting the token from the DDBB');
          }
        }
      );
    }
  },

  /**
   * Gets a node connector (from memory)
   */
  getNode: function (token, callback) {
    log.debug("dataManager::getNode --> getting node from memory");
    if(this.nodesTable[token]) {
      callback(this.nodesTable[token]);
    }
    callback(false);
  },

  // TODO: Verify that the node exists before add the application
  /**
   * Register a new application
   */
  registerApplication: function (appToken, nodeToken, pbkbase64, callback) {
    // Store in persistent storage
    dataStore.registerApplication(appToken, nodeToken, pbkbase64, callback);
  },

  /**
   * Recover a message data and associated UAs
   */
  getMessage: function (id, callbackFunc, callbackParam) {
    // Recover from the persistent storage
    dataStore.getMessage(id, onMessage, {"messageId": id,
                                         "callbackFunction": callbackFunc,
                                         "callbackParam": callbackParam}
                        );
  },

  /**
   * Get all messages for a UA
   */
  getAllMessages: function(uatoken, callbackFunc) {
    // Recover from the persistent storage
    dataStore.getAllMessages(uatoken, callbackFunc);
  }
};

///////////////////////////////////////////
// Callbacks functions
///////////////////////////////////////////
function onMessage(message, message_info) {
  log.debug("dataManager::onMessage --> Message payload: " + JSON.stringify(message[0].payload));
  message_info.callbackFunction({"messageId": message_info.id,
                                 "payload": message[0].payload,
                                 "data": message_info.callbackParam}
                               );
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var dm = new datamanager();
function getDataManager() {
  return dm;
}

exports.getDataManager = getDataManager;
