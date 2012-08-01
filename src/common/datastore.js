/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mongodb = require("mongodb");
var log = require("./logger.js").getLogger;

var ddbbsettings = require("../config.js").ddbbsettings;

function datastore() {
  log.info("MongoDB data store loaded.");

  var servers = [];
  ddbbsettings.machines.forEach(function(machine) {
    servers.push(new mongodb.Server(machine[0], machine[1], {auto_reconnect: true }));
  });
  var replSet = new mongodb.ReplSetServers(servers, {rs_name:ddbbsettings.replicasetName});

  // Connection to MongoDB
  this.db = new mongodb.Db(ddbbsettings.ddbbname, replSet);

  // Establish connection to db
  this.db.open(function(err, db) {
    if(!err) {
      log.info("Connected to MongoDB on " + ddbbsettings.machines + ". Database Name: " + ddbbsettings.ddbbname);
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
  registerNode: function (token, serverId, data) {
    // Register in MONGO that this server manages this node
    this.db.collection("nodes", function(err, collection) {
      collection.update( { 'token': token },
                         { 'token': token, 'serverId': serverId, 'data': data },
                         { upsert: true },
                         function(err,d) {
        if(!err)
          log.debug("Node inserted/update into MongoDB");
        else
          log.debug("Error inserting/updating node into MongoDB -- " + err);
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
        if(!err && callbackFunc)
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
        if(!err)
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
        if(!err && callbackFunc)
          callbackFunc(d, callbackParam);
        else
          log.debug("Error finding application into MongoDB: " + err);
      });
    });
  },

  /**
   * Get the Pbk of the WA.
   */
  getPbkApplication: function(watoken) {
    /*this.db.collection("apps", function(err, collection) {
      collection.find();
    }*/
  },

  /**
   * Save a new message
   * @return New message as stored on DB
   */
  newMessage: function (id, watoken, message) {
    var msg = { 'MsgId': id, 'watoken': watoken, 'payload': message };
    this.db.collection("messages", function(err, collection) {
      collection.insert(msg, function(err,d) {
        if(!err)
          log.debug("Message inserted into MongoDB");
        else
          log.debug("Error inserting message into MongoDB");
      });
    });
    return msg;
  },

  /**
   * Get a message
   */
  getMessage: function (id, callbackFunc, callbackParam) {
    log.debug("Looking for message " + id);
    // Get from MongoDB
    this.db.collection("messages", function(err, collection) {
      collection.find( { 'MsgId': id } ).toArray(function(err,d) {
        if(!err) {
          if (callbackFunc) {
            callbackFunc(d, callbackParam);
          } else {
            return d;
          }
        } else {
          log.debug("Error finding message from MongoDB: " + err);
        }
      });
    });
  },

  /**
   * Get all messages for a UA
   */
  getAllMessages: function (uatoken, callbackFunc) {
    // TODO: Recover only messages for UAToken !
    log.debug("Looking for messages of " + uatoken);
    // Get from MongoDB
    this.db.collection("messages", function(err, collection) {
      collection.find( { 'uatoken': uatoken } ).toArray(function(err,d) {
        if(!err && callbackFunc) {
          console.log(d);
          callbackFunc(d);
        }
        else
          log.debug("Error finding messages from MongoDB: " + err);
      });
    });
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var ds = new datastore();
function getDataStore() {
  return ds;
}

exports.getDataStore = getDataStore;
