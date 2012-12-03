/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dataStore = require("../common/datastore"),
    log = require("../common/logger.js"),
    helpers = require("../common/helpers.js"),
    Connectors = require("./connectors/connector.js").getConnector(),
    ddbbsettings = require("../config.js").NS_AS.ddbbsettings;

function datamanager() {
  log.info("dataManager --> In-Memory data manager loaded.");
}

datamanager.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function (data, connection, callback) {
    Connectors.getConnector(data, connection, function(err, connector) {
      if(err) {
        connection.res({
          errorcode: errorcodesWS.ERROR_GETTING_CONNECTOR,
          extradata: { messageType: "registerUA" }
        });
        return log.error("WS::onWSMessage --> Error getting connection object");
      } else {
        var server = "";
        if(connector.getType() == "UDP") {
          server = "UDP";
        } else {
          server = process.serverId;
        }

        log.debug("dataManager::registerNode --> Registraton of the node into datastore " + data.uatoken);
        dataStore.registerNode(
          data.uatoken,
          server,
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
    if (!uatoken) {
      log.debug("dataManager::unregisterNode --> This connection does not have a uatoken, not registered");
      return;
    } else {
      log.debug("dataManager::unregisterNode --> Removing disconnected node uatoken " + uatoken);
      //Delete from DDBB
      dataStore.unregisterNode(
        uatoken,
        function(error) {
          if (!error) {
            log.debug('dataManager::unregisterNode --> Unregistered');
          } else {
            log.error('dataManager::unregisterNode --> There was a problem unregistering the uatoken ' + uatoken);
          }
        }
      );
    }
    var connector = Connectors.getConnectorForUAtoken(uatoken);
    if(!connector) {
      return;
    }
    connector.getConnection().uatoken = null;
    connector.getConnection().close();
    log.debug("dataManager::unregisterNode --> Finished");
  },

  /**
   * Gets a node connector (from memory)
   */
  getNode: function (token, callback) {
    log.debug("dataManager::getNode --> getting node from memory: " + token);
    var connector = Connectors.getConnectorForUAtoken(token);
    if (connector) {
      log.debug('dataManager::getNode --> Connector found: ' + token);
      return callback(connector);
    }
    return callback(null);
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
  registerApplication: function (appToken, waToken, nodeToken, pbkbase64, callback) {
    // Store in persistent storage
    dataStore.registerApplication(appToken, waToken, nodeToken, pbkbase64, callback);
  },

 /**
   * Unregister an old application
   */
  unregisterApplication: function (appToken, nodeToken, pbkbase64, callback) {
    // Remove from persistent storage
    dataStore.unregisterApplication(appToken, nodeToken, pbkbase64, callback);
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
   * Recover a message data and associated UAs
   */
  getMessage: function (id, callback, callbackParam) {
    // Recover from the persistent storage
    dataStore.getMessage(id, onMessage, {"messageId": id,
                                         "callback": callback,
                                         "callbackParam": callbackParam}
                        );
  },

  /**
   * Get all messages for a UA
   */
  getAllMessages: function(uatoken, callback) {
    var callbackParam = false;
    var connector = Connectors.getConnectorForUAtoken(uatoken);
    if (!connector) {
      return callback(true);
    }

    if (connector.getType() == "UDP") {
      callbackParam = true;
    }
    dataStore.getAllMessages(uatoken, callback);
  },

  /**
   * Delete an ACK'ed message
   */
  removeMessage: function(messageId) {
    dataStore.removeMessage(messageId);
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
