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
  log.info("FAKE -- datastore::starting --> MongoDB data store loading.");

  if (ddbbsettings.replicasetName) {
    //Filling the replicaset data
    var servers = [];
    ddbbsettings.machines.forEach(function(machine) {
      servers.push(new mongodb.Server(machine[0], machine[1], {auto_reconnect: true }));
    });
    var replSet = new mongodb.ReplSetServers(servers, {rs_name:ddbbsettings.replicasetName});

    // Connection to MongoDB
    this.db = new mongodb.Db(ddbbsettings.ddbbname, replSet);
  } else {
    this.db = new mongodb.Db(
      ddbbsettings.ddbbname,
      new mongodb.Server(
        ddbbsettings.machines[0][0], //host
        ddbbsettings.machines[0][1] //port
      )
    );
  }

  // Establish connection to db
  this.db.open(function(err, db) {
    if(!err) {
      log.info("FAKE -- datastore::starting --> Connected to MongoDB on " + ddbbsettings.machines + ". Database Name: " + ddbbsettings.ddbbname);
    } else {
      log.error("FAKE -- datastore::starting --> Error connecting to MongoDB ! - " + err);
      // TODO: Cierre del servidor? Modo alternativo?
    }
  });
}

datastore.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function (token, serverId, data, callback) {
    // Register in MONGO that this server manages this node
    this.db.collection("nodes", function(err, collection) {
      if (!err) {
        collection.save( { _id: token, serverId: serverId, data: data },
                         { safe: true },
                         function(err,d) {
          if(!err && d) {
            log.debug("FAKE -- datastore::registerNode --> Node inserted/update into MongoDB");
            callback(true);
          }
          else {
            log.debug("FAKE -- datastore::registerNode --> Error inserting/updating node into MongoDB -- " + err);
            callback(false);
          }
        });
      } else {
        log.error("FAKE -- datastore::registerNode --> There was a problem opening the nodes collection");
        callback(false);
      }
    });
  },

  /**
   * Gets a node - server relationship
   */
  getNode: function (token, callbackFunc, callbackParam) {
    // Get from MongoDB
    this.db.collection("nodes", function(err, collection) {
      if (!err) {
        collection.findOne( { _id: token }, function(err,d) {
          if(!err && callbackFunc && d) {
            log.debug('FAKE -- Finding info for node ' + token);
            log.debug("FAKE -- datastore::getNode --> Data found, calling callback with data");
            callbackFunc(d, callbackParam);
          }
          else if (!d && !err) {
            log.debug('FAKE -- Finding info for node ' + token);
            log.debug("FAKE -- datastore::getNode --> No error, but no nodes to notify");
          } else {
            log.debug('FAKE -- Finding info for node ' + token);
            log.debug("FAKE -- datastore::getNode --> Error finding node into MongoDB: " + err);
          }
        });
      } else {
        log.error("FAKE -- datastore::getNode --> there was a problem opening the nodes collection");
      }
    });
  },

  // TODO: Verify that the node exists before add the application
  /**
   * Register a new application
   */
  registerApplication: function (waToken, nodeToken, pbkbase64, callback) {
    // Store in MongoDB
    this.db.collection("apps", function(err, collection) {
      if (!err) {
        collection.update( { _id: waToken },
          { $addToSet : { node: nodeToken, pbkbase64: pbkbase64 }},
          {safe: true, upsert: true},
          function(err,d) {
            if(!err) {
              log.debug("FAKE -- datastore::registerApplication --> Application inserted into MongoDB");
              callback(true);
            } else {
              log.debug("FAKE -- datastore::registerApplication --> Error inserting application into MongoDB: " + err);
              callback(false);
            }
          });
      } else {
        log.error("FAKE -- datastore::registerApplication --> there was a problem opening the apps collection");
        callback(false);
      }
    });
  },

  /**
   * Gets an application node list
   */
  getApplication: function (token, callbackFunc, callbackParam) {
    // Get from MongoDB
    this.db.collection("apps", function(err, collection) {
      if (!err) {
        collection.findOne( { _id: token }, function(err,d) {
          if(!err && callbackFunc && d) {
            //console.log("err=" + err + ". callbackFunc=" + callbackFunc + ". d=" + d);
            callbackFunc(d, callbackParam);
          }
          else
            log.debug("FAKE -- datastore::getApplication -->Error finding application from MongoDB: " + err);
        });
      } else {
        log.error("FAKE -- datastore::getApplication --> there was a problem opening the apps collection");
      }
    });
  },

  /**
   * Get the Pbk of the WA.
   * @ return the pbk.
   */
  getPbkApplication: function(watoken2, callback) {
    var watoken = watoken2.toString();
    log.debug("FAKE -- datastore::getPbkApplication --> Going to find the pbk for the watoken " + watoken);
    this.db.collection("apps", function(err, collection) {
      if (!err) {
        collection.findOne( { _id: watoken }, function(err, d){
          if (!err && d) {
            var pbkbase64 = d.pbkbase64.toString('base64');
            log.debug("FAKE -- datastore::getPbkApplication --> Found the pbk (base64) '" + pbkbase64 + "' for the watoken '" + watoken);
            //WARN: This returns the base64 as saved on the DDBB!!
            callback(pbkbase64);
          }
          else if (!err && !d){
            log.debug('FAKE -- datastore::getPbkApplication --> There are no pbk for the WAToken' + watoken);
            callback();
          } else {
            log.debug('FAKE -- datastore::getPbkApplication --> There was a problem finding the pbk for the WAToken');
            callback();
          }
        });
      } else {
        log.error('FAKE -- datastore::getPbkApplication --> there was a problem opening the apps collection');
        callback();
      }
    });
  },

  /**
   * Save a new message
   * @return New message as stored on DB
   */
  newMessage: function (id, watoken, message) {
    var msg = { _id: id, watoken: watoken, payload: message };
    this.db.collection("messages", function(err, collection) {
      if (!err) {
        collection.save(msg, { safe: true }, function(err, d) {
          if(!err && d)
            log.debug("FAKE -- datastore::newMessage --> Message inserted into MongoDB");
          else
            log.debug("FAKE -- datastore::newMessage --> Error inserting message into MongoDB");
        });
      } else {
        log.error("FAKE -- datastore::newMessage --> There was a problem opening the messages collection");
      }
    });
    return msg;
  },

  /**
   * Get a message
   */
  getMessage: function (id, callbackFunc, callbackParam) {
    log.debug("FAKE -- Looking for message " + id);
    // Get from MongoDB
    this.db.collection("messages", function(err, collection) {
      if (!err) {
        collection.findOne( { 'MsgId': id }, function(err,d) {
          if(!err) {
            if (callbackFunc && d) {
              log.debug("FAKE -- datastore::getMessage --> The message has been inserted. Calling callback");
              callbackFunc(d, callbackParam);
            } else {
              log.debug("FAKE -- datastore::getMessage --> The message has been inserted.");
              return d;
            }
          } else {
            log.debug("FAKE -- datastore::getMessage --> Error finding message from MongoDB: " + err);
          }
        });
      } else {
        log.error("datastore::getMessage --> There was a problem opening the messages collection");
      }
    });
  },

  /**
   * Get all messages for a UA
   */
  getAllMessages: function (uatoken, callbackFunc) {
    // TODO: Recover only messages for UAToken !
    log.debug("FAKE -- Looking for messages of " + uatoken);
    // Get from MongoDB
    this.db.collection("messages", function(err, collection) {
      if (!err) {
        collection.find( { _id: uatoken } ).toArray(function(err,d) {
          if(!err && callbackFunc && d) {
            log.debug("FAKE -- datastore::getAllMessages --> Messages found, calling callback");
            callbackFunc(d);
          }
          else if (!err && !d) {
            log.debug("FAKE -- datastore::getAllMessages --> No messages found");
          }
        });
      } else {
        log.error("FAKE -- datastore::getAllMessages --> There was a problem opening the messages collection");
      }
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
