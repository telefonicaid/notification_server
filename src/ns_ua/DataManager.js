/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var DataStore = require('../common/DataStore'),
    Log = require('../common/Logger.js'),
    events = require('events'),
    util = require('util'),
    Connectors = require('./connectors/Connector.js').getConnector(),
    errorcodesWS = require('../common/constants.js').errorcodes.UAWS,
    connectionstate = require('../common/constants.js').connectionstate;

function DataManager() {

  this.start = function() {
    events.EventEmitter.call(this);
    this.ready = false;
    Log.info('dataManager --> In-Memory data manager loading.');

    var self = this;
    DataStore.on('ready', function() {
      self.emit('ready');
      self.ready = true;
      Log.info('dataManager --> In-Memory data manager loaded.');
    });
    DataStore.on('closed', function() {
      self.ready = false;
      self.emit('closed');
    });
    process.nextTick(function() {
      DataStore.start();
    });
  },

  this.stop = function() {
    DataStore.stop();
  },

  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  this.registerNode = function(data, connection, callback) {
    Connectors.getConnector(data, connection, function(err, connector) {
      if (err) {
        connection.res({
          errorcode: errorcodesWS.ERROR_GETTING_CONNECTOR,
          extradata: { messageType: 'hello' }
        });
        Log.error(Log.messages.ERROR_WSERRORGETTINGCONNECTION);
        return;
      }

      Log.debug('dataManager::registerNode --> Registraton of the node into datastore ' + data.uaid);
      DataStore.registerNode(
        data.uaid,
        connector.getServer(),
        {
          wakeup_hostport: connector.getInterface(),
          mobilenetwork: connector.getMobileNetwork(),
          protocol: connector.getProtocol(),
          canBeWakeup: connector.canBeWakeup()
        },
        callback
      );
    });
  },

  /**
   * Unregisters (or inform about disconnection) a Node from the DDBB and memory
   */
  this.unregisterNode = function(uaid) {
    Log.debug('dataManager::unregisterNode --> Going to unregister a node');
    if (!uaid) {
      //Might be a connection closed that has no uaid associated (e.g. registerWA without registerUA before)
      Log.debug('dataManager::unregisterNode --> This connection does not have a uaid');
      return;
    }

    Log.debug('dataManager::unregisterNode --> Removing disconnected node uaid ' + uaid);
    //Delete from DDBB
    var connector = Connectors.getConnectorForUAID(uaid);
    var fullyDisconnected = connectionstate.DISCONNECTED;
    var server = '';
    if (!connector) {
      Log.debug('dataManager::unregisterNode --> No connector found for uaid=' + uaid);
    } else {
      fullyDisconnected = connector.canBeWakeup() ? connectionstate.WAKEUP : connectionstate.DISCONNECTED;
      server = connector.getServer();
    }
    DataStore.unregisterNode(
      uaid,
      server,
      fullyDisconnected,
      function(error) {
        if (!error) {
          Log.debug('dataManager::unregisterNode --> Unregistered');
        } else {
          Log.error(Log.messages.ERROR_DMERRORUNREGISTERUA, {
            'uaid': uaid
          });
        }
      }
    );
    if (connector) {
      Connectors.unregisterUAID(uaid);
    }
  },


  /**
   * Gets a node connector (from memory)
   */
  this.getNodeConnector = function (uaid) {
    Log.debug('dataManager::getNodeConnector --> getting node from memory: ' + uaid);
    return Connectors.getConnectorForUAID(uaid);
  },

  /**
   * Gets a node info from DB
   */
  this.getNodeData = function(uaid, callback) {
    DataStore.getNodeData(uaid, callback);
  },

  /**
   * Register a new application
   */
  this.registerApplication = function (appToken, channelID, uaid, callback) {
    // Store in persistent storage
    DataStore.registerApplication(appToken, channelID, uaid, callback);
  },

 /**
   * Unregister an old application
   */
 this.unregisterApplication = function (appToken, uaid, callback) {
    // Remove from persistent storage
    DataStore.unregisterApplication(appToken, uaid, callback);
  },

  /**
   * Recover a list of WA associated to a UA
   */
  this.getApplicationsForUA = function (uaid, callback) {
    DataStore.getApplicationsForUA(uaid, callback);
  },

  /**
   * ACKs an ack'ed message
   */
  this.ackMessage = function(uaid, channelID, version) {
    DataStore.ackMessage(uaid, channelID, version);
  };
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
util.inherits(DataManager, events.EventEmitter);
var dm = new DataManager();
function getDataManager() {
  return dm;
}

module.exports = getDataManager();
