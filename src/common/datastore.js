/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mongodb = require("mongodb");
var log = require("./logger.js").getLogger;

var ddbbsettings = require("../config.js").NS_AS.ddbbsettings;

function datastore() {
  log.info("MongoDB data store loaded.");

  // Connection to MongoDB
  this.db = new mongodb.Db(
    ddbbsettings.ddbbname,
    new mongodb.Server(
      ddbbsettings.host,
      ddbbsettings.port,
      {
        auto_reconnect: ddbbsettings.auto_reconnect,
        poolSize: ddbbsettings.poolSize
      }
    ),
    {
      native_parser: ddbbsettings.native_parser
    }
  );

  // Establish connection to db
  this.db.open(function(err, db) {
    if(err == null) {
      log.info("Connected to MongoDB on " + ddbbsettings.host + ":" + ddbbsettings.port + ", Database Name: " + ddbbsettings.ddbbname);
    } else {
      log.error("Error connecting to MongoDB ! - " + err);
      // TODO: Cierre del servidor? Modo alternativo?
    }
  });
}

datastore.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function (token, serverId) {
    // Register in MONGO that this server manages this node
    this.db.collection("nodes", function(err, collection) {
      collection.update( { 'token': token },
                         { 'token': token, 'serverId': serverId },
                         { upsert: true },
                         function(err,d) {
        if(err == null)
          log.debug("Node inserted/update into MongoDB");
        else
          log.debug("Error inserting/updating node into MongoDB");
      });
    });
  },

  /**
   * Gets a node - server relationship
   */
  getNode: function (token, callbackFunc, callbackParam) {
    // Get from MongoDB
    this.db.collection("nodes", function(err, collection) {
      collection.find( { 'token': token } ).toArray(function(err,d) {
        if(err == null)
          callbackFunc(d, callbackParam);
        else
          log.debug("Error finding node into MongoDB: " + err);
      });
    });
  },

  // TODO: Verify that the node exists before add the application
  /**
   * Register a new application
   */
  registerApplication: function (appToken, nodeToken) {
    // Store in MongoDB
    this.db.collection("apps", function(err, collection) {
      collection.update( {'token': appToken},
                         {$push : { 'node': nodeToken }},
                         {upsert: true},
                         function(err,d) {
        if(err == null)
          log.debug("Application inserted into MongoDB");
        else
          log.debug("Error inserting application into MongoDB: " + err);
      });
    });
  },

  /**
   * Gets an application node list
   */
  getApplication: function (token, callbackFunc, callbackParam) {
    // Get from MongoDB
    this.db.collection("apps", function(err, collection) {
      collection.find( { 'token': token } ).toArray(function(err,d) {
        if(err == null)
          callbackFunc(d, callbackParam);
        else
          log.debug("Error finding application into MongoDB: " + err);
      });
    });
  },

  /**
   * Save a new message
   */
  newMessage: function (id, watoken, message) {
    this.db.collection("messages", function(err, collection) {
      collection.insert( { 'MsgId': id, 'watoken': watoken, 'payload': message },
                         function(err,d) {
        if(err == null)
          log.debug("Message inserted into MongoDB");
        else
          log.debug("Error inserting message into MongoDB");
      });
	  });
  },

  /**
   * Get a message
   */
  getMessage: function (id, callbackFunc, callbackParam) {
	log.debug("Looking for message " + id);
    // Get from MongoDB
    this.db.collection("messages", function(err, collection) {
      collection.find( { 'MsgId': id } ).toArray(function(err,d) {
        if(err == null)
          callbackFunc(d, callbackParam);
        else
          log.debug("Error finding message into MongoDB: " + err);          
      });
    });
  }
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var ds = new datastore();
function getDataStore() {
  return ds;
}

exports.getDataStore = getDataStore;
