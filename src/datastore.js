/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

function datastore() {
  console.log("Hash table based data store loaded.");

  this.appsTable = {};
  this.nodesTable = {};
}

datastore.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connection WS object
   */
  registerNode: function(token, connection) {
    if(this.nodesTable[token]) {
      console.log("Removing old node token " + token);
      delete(this.nodesTable[token]);
    }

    // Register a new node
    this.nodesTable[token] = connection;
  },

  /**
   * Get a node connector
   */
  getNode: function(token) {
    if(this.nodesTable[token]) {
      return this.nodesTable[token];
    }
    return false;
  }
}

var ds = new datastore();
function getDataStore() {
  return ds;
}

exports.getDataStore = getDataStore;
