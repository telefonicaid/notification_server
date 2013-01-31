/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dataStore = require('../common/datastore'),
    log = require('../common/logger.js'),
    helpers = require('../common/helpers.js'),
    Connectors = require('./connectors/connector.js').getConnector(),
    ddbbsettings = require('../config.js').NS_AS.ddbbsettings;

function datamanager() {
  log.info('dataManager --> In-Memory data manager loaded.');
}

datamanager.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function(data, connection, callback) {
    Connectors.getConnector(data, connection, function(err, connector) {
      if (err) {
        connection.res({
          errorcode: errorcodesWS.ERROR_GETTING_CONNECTOR,
          extradata: { messageType: 'registerUA' }
        });
        return log.error('WS::onWSMessage --> Error getting connection object');
      } else {
        log.debug('dataManager::registerNode --> Registraton of the node into datastore ' + data.uatoken);
        dataStore.registerNode(
          data.uatoken,
          connector.getServer(),
          {
            interface: connector.getInterface(),
            mobilenetwork: connector.getMobileNetwork(),
            protocol: connector.getProtocol()
          },
          callback
        );
      }
    });
  },

  /**
   * Unregisters a Node from the DDBB and memory
   */
  unregisterNode: function(uatoken) {
    log.debug('dataManager::unregisterNode --> Going to unregister a node');
    var connector = null;
    if (!uatoken) {
      //Might be a connection closed that has no uatoken associated (e.g. registerWA without registerUA before)
      log.debug('dataManager::unregisterNode --> This connection does not have a uatoken');
      return;
    } else {
      log.debug('dataManager::unregisterNode --> Removing disconnected node uatoken ' + uatoken);
      //Delete from DDBB
      connector = Connectors.getConnectorForUAtoken(uatoken);
      var fullyDisconnected = 0;
      if (!connector) {
        log.debug('dataManager::unregisterNode --> No connector found for uatoken=' + uatoken);
      } else {
        fullyDisconnected = (connector.getProtocol() !== 'WS') ? 2 : 0;
      }
      dataStore.unregisterNode(
        uatoken,
        fullyDisconnected,
        function(error) {
          if (!error) {
            log.debug('dataManager::unregisterNode --> Unregistered');
          } else {
            log.error('dataManager::unregisterNode --> There was a problem unregistering the uatoken ' + uatoken);
          }
        }
      );
    }
    if (connector) {
      Connectors.unregisterUAToken(uatoken);
    }
  },

  /**
   * Gets a node connector (from memory)
   */
  getNode: function (uatoken, callback) {
    log.debug("dataManager::getNode --> getting node from memory: " + uatoken);
    var connector = Connectors.getConnectorForUAtoken(uatoken);
    if (connector) {
      log.debug('dataManager::getNode --> Connector found: ' + uatoken);
      return callback(connector);
    }
    return callback(null);
  },

  /**
   * Gets a node info from DB
   */
  getNodeData: function(uatoken, callback) {
    dataStore.getNodeData(uatoken, callback);
  },

  /**
   * Gets a UAToken from a given connection object
   */
  getUAToken: function (connection) {
    return connection.uatoken || null;
  },

  // TODO: Verify that the node exists before add the application issue #59
  /**
   * Register a new application
   */
  registerApplication: function (appToken, waToken, uatoken, pbkbase64, callback) {
    // Store in persistent storage
    dataStore.registerApplication(appToken, waToken, uatoken, pbkbase64, callback);
  },

 /**
   * Unregister an old application
   */
  unregisterApplication: function (appToken, uatoken, pbkbase64, callback) {
    // Remove from persistent storage
    dataStore.unregisterApplication(appToken, uatoken, pbkbase64, callback);
  },

  /**
   * Recover a list of WA associated to a UA
   */
  getApplicationsForUA: function (uaToken, callback) {
    // Recover from the persistent storage
    var callbackParam = false;
    dataStore.getApplicationsForUA(uaToken, callback, callbackParam);
  },

  /**
   * Get all messages for a UA
   */
  getAllMessagesForUA: function(uatoken, callback) {
    dataStore.getAllMessagesForUA(uatoken, callback);
  },

  /**
   * Delete an ACK'ed message
   */
  removeMessage: function(messageId, uatoken) {
    if(!messageId || !uatoken) {
      log.error('dataStore::removeMessage --> FIX YOUR BACKEND');
      return;
    }
    dataStore.removeMessage(messageId, uatoken);
  }
};

///////////////////////////////////////////
// Callbacks functions
///////////////////////////////////////////
function onMessage(message, message_info) {
  log.debug("dataManager::onMessage --> Message payload:", message[0].payload);
  message_info.callback(
    {
      messageId: message_info.id,
      payload: message[0].payload,
      data: message_info.callbackParam
    }
  );
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var dm = new datamanager();
function getDataManager() {
  return dm;
}

module.exports = getDataManager();
