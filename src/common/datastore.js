/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mongodb = require("mongodb"),
    log = require("./logger.js"),
    events = require("events"),
    util = require("util"),
    ddbbsettings = require("../config.js").ddbbsettings,
    helpers = require("../common/helpers.js");

var DataStore = function() {
  this.init = function() {
    log.info("datastore::starting --> MongoDB data store loading.");
    events.EventEmitter.call(this);

    if (ddbbsettings.replicasetName) {
      //Filling the replicaset data
      var servers = [];
      ddbbsettings.machines.forEach(function(machine) {
        servers.push(new mongodb.Server(machine[0], machine[1], { auto_reconnect: true }));
      });
      var replSet = new mongodb.ReplSetServers(servers,
        {
          rs_name:ddbbsettings.replicasetName,
          read_secondary: true,
          safe: true
        }
      );

      // Connection to MongoDB
      this.db = new mongodb.Db(ddbbsettings.ddbbname, replSet);
    } else {
      this.db = new mongodb.Db(
        ddbbsettings.ddbbname,
        new mongodb.Server(
          ddbbsettings.machines[0][0], //host
          ddbbsettings.machines[0][1], //port
          {
            auto_reconnect: true,
            safe: true
          }
        )
      );
    }

    // Establish connection to db
    this.db.open(function(err, db) {
      if(err) {
        log.critical("datastore::starting --> Error connecting to MongoDB ! - " + err);
        this.close();
      } else {
        log.info("datastore::starting --> Connected to MongoDB on " + ddbbsettings.machines + ". Database Name: " + ddbbsettings.ddbbname);
        this.emit('ddbbconnected');
      }
    }.bind(this));
  },

  this.close = function() {
    log.info('datastore::close --> Closing connection to DB');
    this.db.close();
  },

  this.registerNode = function (token, serverId, data, callback) {
    this.db.collection("nodes", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.save({
                          _id: token, // indexar
                          serverId: serverId, //indexar
                          data: data, // indexar
                          connected: true,
                          timestamp: parseInt(new Date().getTime(), 10),
                          notifications: [],
                          appURLs: [] //indexar
                        },
                        { upsert: true },
                        function(err, data) {
          if(err) {
            log.error("datastore::registerNode --> Error inserting/updating node into MongoDB -- " + err);
            return callback(err);
          } else {
            log.debug("dataStore::registerNode --> Node inserted/updated ", data);
            return callback(null, data);
          }
        });
      } else {
        log.error("datastore::registerNode --> There was a problem opening the nodes collection -- " + err);
        return callback(err);
      }
    });
  };

  /**
   * Unregister a node
   * TODO: Unregister linked apps
   */
   this.unregisterNode = function(token, callback) {
    this.db.collection("nodes", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.remove( { _id: token },
                         { safe: true },
                         function(err, data) {
          if (err) {
            log.error("dataStore::unregisterNode --> There was a problem removing the node: " +  err);
            return callback(err);
          } else {
            log.debug("datastore::unregisterNode --> Node removed from MongoDB");
            return callback(null, data);
          }
        });
      } else {
        log.error("datastore::unregisterNode --> There was a problem opening the nodes collection: " + err);
        return callback(err);
      }
    });
   };

  /**
   * Gets a node - server relationship
   */
  this.getNode = function (token, callback, callbackParam) {
    log.debug('datastore::getNode --> Finding info for node ' + token);
    // Get from MongoDB
    this.db.collection("nodes", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.findOne( { _id: token }, function(err, data) {
          if(err) {
            log.error("datastore::getNode --> Error finding node into MongoDB: " + err);
            callback(err);
          } else {
            if(data) {
              log.debug("datastore::getNode --> Data found, calling callback with data");
              callback(null, data, callbackParam);
            } else {
              log.debug("datastore::getNode --> Node not found!");
              callback(null, null, callbackParam);
            }
          }
        });
      } else {
        log.error("datastore::getNode --> there was a problem opening the nodes collection: " + err);
        callback(err);
      }
    });
  },

  // TODO: Verify that the node exists before add the application Issue #59
  /**
   * Register a new application
   */
  this.registerApplication = function (appToken, waToken, nodeToken, pbkbase64, callback) {
    // Store in MongoDB
    this.db.collection("apps", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.update( { _id: appToken },
          { $addToSet : { node: nodeToken }, $set : { pbkbase64: pbkbase64, waToken: waToken }},
          {safe: true, upsert: true},
          function(err, data) {
            if(err) {
              log.error("datastore::registerApplication --> Error inserting application into MongoDB: " + err);
              return callback(err);
            } else {
              log.debug("datastore::registerApplication --> Application inserted into MongoDB");
              return callback(null, data);
            }
          });
      } else {
        log.error("datastore::registerApplication --> there was a problem opening the apps collection: " + err);
        return callback(err);
      }
    });
  },

  /**
   * Unregister an old application
   */
  this.unregisterApplication = function (appToken, nodeToken, pbkbase64, callback) {
    // Remove from MongoDB
    this.db.collection("apps", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.findAndModify( { _id: appToken },         // query
          [],                                               // sort
          { $pull : { node: nodeToken } },                  // update
          { new: true },                                    // options
          function(err, d) {
            if(!err) {
              log.debug("datastore::unregisterApplication --> Node removed of the application into MongoDB");
              if(!d.node.length) {
                log.debug("datastore::unregisterApplication --> No more nodes vinculed to this webapp. Removing app from MongoDB");
                collection.remove( { _id: appToken },
                                { safe: true },
                                function(err, data) {
                  if(!err) {
                    log.debug("datastore::unregisterApplication --> Application removed from MongoDB");
                    return callback(null, data);
                  } else {
                    log.debug("datastore::unregisterApplication --> Error removing application from MongoDB: " + err);
                    return callback(err);
                  }
                });
              } else {
                return callback(null, d);
              }
            } else {
              log.debug("datastore::registerApplication --> Error removing node of the application into MongoDB: " + err);
              return callback(err);
            }
          });
      } else {
        log.error("datastore::unregisterApplication --> there was a problem opening the apps collection: " + err);
        return callback(err);
      }
    });
  },

  /**
   * Recover a list of WA associated to a UA
   */
  this.getApplicationsForUA = function (uaToken, callback, callbackParam) {
    // Get from MongoDB
    log.debug("datastore::getApplicationsOnUA --> Going to find applications in UA: " + uaToken);
    this.db.collection("apps", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.find( { node: uaToken }, { _id: true } ).toArray(function(err, data) {
          if (err) {
            log.error("datastore::getApplicationsForUA --> Error finding applications from MongoDB: " + err);
            callback(err);
          } else {
            if (data.length) {
              log.debug("datastore::getApplicationsOnUA --> Applications recovered, calling callback");
              callback(null, data, callbackParam);
            } else {
              log.debug("datastore::getApplicationsOnUA --> No applications recovered :(");
              callback(null, null, callbackParam);
            }
          }
        });
      } else {
        log.error("datastore::getApplicationsForUA --> there was a problem opening the apps collection");
        callback(err);
      }
    });
  },

  /**
   * Gets an application node list
   */
  this.getApplication = function (token, callback, callbackParam) {
    // Get from MongoDB
    log.debug("datastore::getApplication --> Going to find application with token: " + token);
    this.db.collection("apps", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.findOne( { _id: token }, function(err, data) {
          if (err) {
            log.error("datastore::getApplication --> Error finding application from MongoDB: " + err);
            callback(err);
          } else {
            log.debug("datastore::getApplication --> Application found");
            if (data) {
                log.debug("datastore::getApplication --> Application found, have callback, calling");
                callback(null, data, callbackParam);
            }
          }
        });
      } else {
        log.error("datastore::getApplication --> there was a problem opening the apps collection");
        callback(err);
      }
    });
  },

  /**
   * Get the Pbk of the WA.
   * @ return the pbk.
   */
  this.getPbkApplication = function(appToken2, callback) {
    var appToken = appToken2.toString();
    log.debug("datastore::getPbkApplication --> Going to find the pbk for the appToken " + appToken);
    this.db.collection("apps", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.findOne( { _id: appToken }, function(err, data) {
          if (err) {
            log.error('datastore::getPbkApplication --> There was a problem finding the PbK - ' + err);
            return callback(err);
          } else {
            if (data) {
              if (data.pbkbase64) {
                var pbkbase64 = data.pbkbase64.toString('base64');
                log.debug("datastore::getPbkApplication --> Found the pbk (base64) '" + pbkbase64 + "' for the appToken '" + appToken);
                //WARN: This returns the base64 as saved on the DDBB!!
                callback(null, pbkbase64);
              } else {
                log.debug('datastore::getPbkApplication --> There are no pbk for the appToken ' + appToken);
                callback("No PbK for the appToken=" + appToken);
              }
            } else {
              log.debug('There are no appToken=' + appToken + ' in the DDBB');
              callback(null, null);
            }
          }
        });
      } else {
        log.error('datastore::getPbkApplication --> there was a problem opening the apps collection: ' +  err);
        callback(err);
      }
    });
  },

  /**
   * Save a new message
   * @return New message as stored on DB
   */
  this.newMessage = function (id, apptoken, message) {
    message.messageId = id;
    message.url = helpers.getNotificationURL(apptoken);
    var msg = { _id: id, watoken: apptoken, payload: message };
    this.db.collection("messages", function(err, collection) {
      if (!err) {
        collection.save(msg, { safe: true }, function(err, data) {
          if (err) {
            log.error("datastore::newMessage --> Error inserting message into MongoDB: " + err);
          } else {
            log.debug("dataStore::newMessage --> Message inserted");
          }
        });
      } else {
        log.error("datastore::newMessage --> There was a problem opening the messages collection: " + err);
      }
    });
    return msg;
  },

  /**
   * Get a message
   */
  this.getMessage = function (id, callback, callbackParam) {
    log.debug("Looking for message " + id);
    // Get from MongoDB
    this.db.collection("messages", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.findOne( { 'MsgId': id }, function(err, data) {
          if (err) {
            log.error("datastore::getMessage --> Error finding message from MongoDB: " + err);
            callback(err);
          } else {
            if (data) {
              log.debug("datastore::getMessage --> Message recovered");
              callback(null, data, callbackParam);
            } else {
              log.debug("datastore::getMessage --> No message :(");
                callback(null, null, callbackParam);
            }
          }
        });
      } else {
        log.error("datastore::getMessage --> There was a problem opening the messages collection: " + err);
        callback(err);
      }
    });
  },

  /**
   * Get all messages for a UA
   */
  this.getAllMessages = function (uatoken, callback, callbackParam) {
    log.debug("Looking for messages of " + uatoken);
    // Get from MongoDB
    this.db.collection("messages", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (err) {
        log.error("datastore::getAllMessages --> There was a problem opening the messages collection: " + err);
        callback(err);
      } else {
        collection.find( { _id: uatoken } ).toArray(function(err, data) {
          if (err) {
            log.error("datastore::getAllMessages --> There was a problem finding the message: " + err);
            callback(err);
          } else {
            if (data.length) {
                log.debug("datastore::getAllMessages --> Messages found, calling callback");
                callback(null, data, callbackParam);
            } else {
                log.debug("datastore::getAllMessages --> No messages found");
                callback(null, null, callbackParam);
            }
          }
        });
      }
    });
  },

  /**
   * Remove a message from the dataStore
   */
  this.removeMessage = function(messageId) {
    log.debug('dataStore::removeMessage --> Going to remove message with _id=' + messageId);
    this.db.collection("messages", function(err, collection) {
      if (!err) {
        collection.remove( { _id: messageId },
                         { safe: true },
                         function(err, d) {
          if(!err) {
            log.debug("datastore::removeMessage --> Message removed from MongoDB");
          } else {

          }
        });
      } else {
        log.error("datastore::removeMessage --> There was a problem opening the messages collection");
      }
    });
  },

  /**
   * Recovers an operator from the dataStore
   */
  this.getOperator = function(mcc, mnc, callback) {
    var id = helpers.padNumber(mcc,3) + "-" + helpers.padNumber(mnc,2);
    log.debug("Looking for operator " + id);
    // Get from MongoDB
    this.db.collection("operators", function(err, collection) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (!err) {
        collection.findOne( { '_id': id }, function(err, data) {
          if(!err) {
            if (data) {
              log.debug("datastore::getOperator --> The operator has been recovered. Calling callback");
              return callback(null, data);
            } else {
              log.debug("datastore::getOperator --> No operator found. Calling callback");
              return callback(null, null);
            }
          } else {
            log.debug("datastore::getOperator --> Error finding operator from MongoDB: " + err);
            return callback(err);
          }
        });
      } else {
        log.error("datastore::getOperator --> There was a problem opening the messages collection");
        return callback(err);
      }
    });
  };
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
util.inherits(DataStore, events.EventEmitter);
var _ds = new DataStore(); _ds.init();
function getDataStore() {
  return _ds;
}

module.exports = getDataStore();
