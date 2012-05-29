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
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function (token, connector) {
    if(this.nodesTable[token]) {
      console.log("Removing old node token " + token);
      delete(this.nodesTable[token]);
    }

    // Register a new node
    this.nodesTable[token] = connector;
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
    var nodes = [nodeToken];
    // If exists, we only shall add the node to the nodes list if it's not registered before
    if ( this.appsTable[appToken] && (this.appsTable[appToken].indexOf(nodeToken) == -1) ) {
      nodes = nodes.concat(this.appsTable[appToken]);
    }
    this.appsTable[appToken] = nodes;
  },

  /**
   * Gets an application node list
   */
  getApplication: function (token) {
    if(this.appsTable[token]) {
      return this.appsTable[token];
    }
    return false;    
  }
}

var ds = new datastore();
function getDataStore() {
  return ds;
}

exports.getDataStore = getDataStore;
