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
    ddbbsettings = require('../config.js').NS_AS.ddbbsettings,
    connectionstate = require('../common/constants.js').connectionstate;

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
          extradata: { messageType: 'hello' }
        });
        return log.error('WS::onWSMessage --> Error getting connection object');
      } else {
        log.debug('dataManager::registerNode --> Registraton of the node into datastore ' + data.uaid);
        dataStore.registerNode(
          data.uaid,
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
   * DEPRECATED: Unregisters a Node from the DDBB and memory
   */
  unregisterNode: function(uaid) {
    log.debug('dataManager::unregisterNode --> Going to unregister a node');
    var connector = null;
    if (!uaid) {
      //Might be a connection closed that has no uaid associated (e.g. registerWA without registerUA before)
      log.debug('dataManager::unregisterNode --> This connection does not have a uaid');
      return;
    } else {
      log.debug('dataManager::unregisterNode --> Removing disconnected node uaid ' + uaid);
      //Delete from DDBB
      connector = Connectors.getConnectorForUAID(uaid);
      var fullyDisconnected = connectionstate.DISCONNECTED;
      if (!connector) {
        log.debug('dataManager::unregisterNode --> No connector found for uaid=' + uaid);
      } else {
        fullyDisconnected = connector.canBeWakeup() ? connectionstate.WAKEUP : connectionstate.DISCONNECTED;
      }
      dataStore.unregisterNode(
        uaid,
        fullyDisconnected,
        function(error) {
          if (!error) {
            log.debug('dataManager::unregisterNode --> Unregistered');
          } else {
            log.error('dataManager::unregisterNode --> There was a problem unregistering the uaid ' + uaid);
          }
        }
      );
    }
    if (connector) {
      Connectors.unregisteruaid(uaid);
    }
  },

  /**
   * Gets a node connector (from memory)
   */
  getNode: function (uaid, callback) {
    log.debug("dataManager::getNode --> getting node from memory: " + uaid);
    var connector = Connectors.getConnectorForUAID(uaid);
    if (connector) {
      log.debug('dataManager::getNode --> Connector found: ' + uaid);
      return callback(connector);
    }
    return callback(null);
  },

  /**
   * Gets a node info from DB
   */
  getNodeData: function(uaid, callback) {
    dataStore.getNodeData(uaid, callback);
  },

  /**
   * Gets a uaid from a given connection object
   */
  getuaid: function (connection) {
    return connection.uaid || null;
  },

  // TODO: Verify that the node exists before add the application issue #59
  /**
   * Register a new application
   */
  registerApplication: function (appToken, channelID, uaid, cert, callback) {
    // Store in persistent storage
    dataStore.registerApplication(appToken, channelID, uaid, cert, callback);
  },

 /**
   * Unregister an old application
   */
  unregisterApplication: function (appToken, uaid, pbkbase64, callback) {
    // Remove from persistent storage
    dataStore.unregisterApplication(appToken, uaid, pbkbase64, callback);
  },

  /**
   * Recover a list of WA associated to a UA
   */
  getApplicationsForUA: function (uaid, callback) {
    // Recover from the persistent storage
    var callbackParam = false;
    dataStore.getApplicationsForUA(uaid, callback, callbackParam);
  },

  /**
   * Get all messages for a UA
   */
  getAllMessagesForUA: function(uaid, callback) {
    dataStore.getAllMessagesForUA(uaid, callback);
  },

  /**
   * Delete an ACK'ed message
   */
  removeMessage: function(messageId, uaid) {
    if(!messageId || !uaid) {
      log.error('dataStore::removeMessage --> FIX YOUR BACKEND');
      return;
    }
    dataStore.removeMessage(messageId, uaid);
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
