/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */
var mongodb = require('mongodb'),
    log = require('./logger.js'),
    events = require('events'),
    util = require('util'),
    ddbbsettings = require('../config.js').ddbbsettings,
    helpers = require('../common/helpers.js');

var DataStore = function() {
  this.init = function() {
    log.info('datastore::starting --> MongoDB data store loading.');
    events.EventEmitter.call(this);

    if (ddbbsettings.replicasetName) {
      //Filling the replicaset data
      var servers = [];
      ddbbsettings.machines.forEach(function(machine) {
        servers.push(new mongodb.Server(machine[0], machine[1], {
          auto_reconnect: true
        }));
      });
      var replSet = new mongodb.ReplSetServers(servers, {
        rs_name: ddbbsettings.replicasetName,
        read_secondary: true
      });

      // Connection to MongoDB
      this.db = new mongodb.Db(ddbbsettings.ddbbname, replSet);
    } else {
      this.db = new mongodb.Db(
          ddbbsettings.ddbbname,
          new mongodb.Server(
          ddbbsettings.machines[0][0], //host
          ddbbsettings.machines[0][1], //port
          {
            auto_reconnect: true
          } //options
          ));
    }

    // Establish connection to db
    this.db.open(function(err, db) {
      if (!err) {
        log.info('datastore::starting --> Connected to MongoDB on ' + ddbbsettings.machines + '. Database Name: ' + ddbbsettings.ddbbname);
        this.emit('ddbbconnected');
      } else {
        log.critical('datastore::starting --> Error connecting to MongoDB ! - ' + err);
        this.close();
      }
    }.bind(this));
  },

  this.close = function() {
    log.info('datastore::close --> Closing connection to DB');
    this.db.close();
  },

  this.registerNode = function(token, serverId, data, callback) {
    // Register in MONGO that this server manages this node
    this.db.collection('nodes', function(err, collection) {
      if (!err) {
        collection.save({
          _id: token,
          serverId: serverId,
          data: data
        }, {
          safe: true
        },

        function(err, d) {
          if (!err && d) {
            log.debug('datastore::registerNode --> Node inserted/update into MongoDB');
            return callback(true);
          } else {
            log.debug('datastore::registerNode --> Error inserting/updating node into MongoDB -- ' + err);
            return callback(false);
          }
        });
      } else {
        log.error('datastore::registerNode --> There was a problem opening the nodes collection');
        return callback(false);
      }
    });
  };

  /**
   * Unregister a node
   */
  this.unregisterNode = function(token, callback) {
    this.db.collection('nodes', function(err, collection) {
      if (!err) {
        collection.remove({
          _id: token
        }, {
          safe: true
        },

        function(err, d) {
          if (!err) {
            log.debug('datastore::unregisterNode --> Node removed from MongoDB');
            return callback(true);
          }
        });
      } else {
        log.error('datastore::unregisterNode --> There was a problem opening the nodes collection');
        return callback(false);
      }
    });
  };

  /**
   * Gets a node - server relationship
   */
  this.getNode = function(token, callbackFunc, callbackParam) {
    log.debug('datastore::getNode --> Finding info for node ' + token);
    // Get from MongoDB
    this.db.collection('nodes', function(err, collection) {
      if (!err) {
        collection.findOne({
          _id: token
        }, function(err, d) {
          if (!err && callbackFunc && d) {
            log.debug('datastore::getNode --> Data found, calling callback with data');
            callbackFunc(d, callbackParam);
          } else if (!d && !err) {
            log.debug('datastore::getNode --> No nodes found');
            callbackFunc(null, callbackParam);
          } else {
            log.debug('datastore::getNode --> Error finding node into MongoDB: ' + err);
            callbackFunc(null, callbackParam);
          }
        });
      } else {
        log.error('datastore::getNode --> there was a problem opening the nodes collection');
        callbackFunc(null, callbackParam);
      }
    });
  },

  // TODO: Verify that the node exists before add the application Issue #59
  /**
   * Register a new application
   */
  this.registerApplication = function(waToken, nodeToken, pbkbase64, callback) {
    // Store in MongoDB
    this.db.collection('apps', function(err, collection) {
      if (!err) {
        collection.update({
          _id: waToken
        }, {
          $addToSet: {
            node: nodeToken
          },
          $set: {
            pbkbase64: pbkbase64
          }
        }, {
          safe: true,
          upsert: true
        },

        function(err, d) {
          if (!err) {
            log.debug('datastore::registerApplication --> Application inserted into MongoDB');
            return callback(true);
          } else {
            log.debug('datastore::registerApplication --> Error inserting application into MongoDB: ' + err);
            return callback(false);
          }
        });
      } else {
        log.error('datastore::registerApplication --> there was a problem opening the apps collection');
        return callback(false);
      }
    });
  },

  /**
   * Unregister an old application
   */
  this.unregisterApplication = function(waToken, nodeToken, pbkbase64, callback) {
    // Remove from MongoDB
    this.db.collection('apps', function(err, collection) {
      if (!err) {
        collection.findAndModify({
          _id: waToken
        }, // query
        [], // sort
        {
          $pull: {
            node: nodeToken
          }
        }, // update
        {
          new: true
        }, // options
        function(err, d) {
          if (!err) {
            log.debug('datastore::unregisterApplication --> Node removed of the application into MongoDB');
            if (d.node.length === 0) {
              log.debug('datastore::unregisterApplication --> No more nodes vinculed to this webapp. Removing app from MongoDB');
              collection.remove({
                _id: waToken
              }, {
                safe: true
              },

              function(err, d) {
                if (!err) {
                  log.debug('datastore::unregisterApplication --> Application removed from MongoDB');
                  return callback(true);
                } else {
                  log.debug('datastore::unregisterApplication --> Error removing application from MongoDB: ' + err);
                  return callback(false);
                }
              });
            } else {
              return callback(true);
            }
          } else {
            log.debug('datastore::registerApplication --> Error removing node of the application into MongoDB: ' + err);
            return callback(false);
          }
        });
      } else {
        log.error('datastore::unregisterApplication --> there was a problem opening the apps collection');
        return callback(false);
      }
    });
  },

  /**
   * Gets an application node list
   */
  this.getApplication = function(token, callbackFunc, callbackParam) {
    // Get from MongoDB
    log.debug('datastore::getApplication --> Going to find application with token: ' + token);
    this.db.collection('apps', function(err, collection) {
      if (!err) {
        collection.findOne({
          _id: token
        }, function(err, d) {
          if (!err && callbackFunc && d) {
            callbackFunc(d, callbackParam);
          } else {
            log.debug('datastore::getApplication --> Error finding application from MongoDB: ' + err);
            callbackFunc(null, callbackParam);
          }
        });
      } else {
        log.error('datastore::getApplication --> there was a problem opening the apps collection');
        callbackFunc(null, callbackParam);
      }
    });
  },

  /**
   * Get the Pbk of the WA.
   * @ return the pbk.
   */
  this.getPbkApplication = function(watoken2, callback) {
    var watoken = watoken2.toString();
    log.debug('datastore::getPbkApplication --> Going to find the pbk for the watoken ' + watoken);
    this.db.collection('apps', function(err, collection) {
      if (!err) {
        collection.findOne({
          _id: watoken
        }, function(err, d) {
          if (err) {
            log.debug('datastore::getPbkApplication --> There was a problem finding the PbK - ' + err);
            return callback();
          } else {
            if (!d) {
              log.debug('There are no WAtoken=' + watoken + ' in the DDBB');
              return callback();
            } else if (d && d.pbkbase64) {
              var pbkbase64 = d.pbkbase64.toString('base64');
              log.debug("datastore::getPbkApplication --> Found the pbk (base64) '" + pbkbase64 + "' for the watoken '" + watoken);
              //WARN: This returns the base64 as saved on the DDBB!!
              return callback(pbkbase64);
            } else if (d && !d.pbkbase64) {
              log.debug('datastore::getPbkApplication --> There are no pbk for the WAToken ' + watoken);
              return callback();
            }
          }
        });
      } else {
        log.error('datastore::getPbkApplication --> there was a problem opening the apps collection');
        return callback();
      }
    });
  },

  /**
   * Save a new message in the Database
   * @return {string} New message as stored on DB.
   */
  this.newMessage = function(id, watoken, message) {
    message.messageId = id;
    message.url = helpers.getNotificationURL(watoken);
    var msg = {
      _id: id,
      watoken: watoken,
      payload: message
    };
    this.db.collection('messages', function(err, collection) {
      if (!err) {
        collection.save(msg, {
          safe: true
        }, function(err, d) {
          if (!err && d) log.debug('datastore::newMessage --> Message inserted into MongoDB');
          else log.debug('datastore::newMessage --> Error inserting message into MongoDB');
        });
      } else {
        log.error('datastore::newMessage --> There was a problem opening the messages collection');
      }
    });
    return msg;
  },

  /**
   * Get a message
   */
  this.getMessage = function(id, callback, callbackParam) {
    log.debug('Looking for message ' + id);
    // Get from MongoDB
    this.db.collection('messages', function(err, collection) {
      if (!err) {
        collection.findOne({
          'MsgId': id
        }, function(err, d) {
          if (!err) {
            if (callback && d) {
              log.debug('datastore::getMessage --> The message has been recovered. Calling callback');
              return callback(d, callbackParam);
            } else {
              log.debug('datastore::getMessage --> The message has been recovered.');
              return d;
            }
          } else {
            log.debug('datastore::getMessage --> Error finding message from MongoDB: ' + err);
          }
        });
      } else {
        log.error('datastore::getMessage --> There was a problem opening the messages collection');
      }
    });
  },

  /**
   * Get all messages for a UA
   */
  this.getAllMessages = function(uatoken, callback, callbackParam) {
    log.debug('Looking for messages of ' + uatoken);
    // Get from MongoDB
    this.db.collection('messages', function(err, collection) {
      if (!err) {
        collection.find({
          _id: uatoken
        }).toArray(function(err, d) {
          if (!err && callback && d) {
            log.debug('datastore::getAllMessages --> Messages found, calling callback');
            return callback(d, callbackParam);
          } else if (!err && !d) {
            log.debug('datastore::getAllMessages --> No messages found');
          }
        });
      } else {
        log.error('datastore::getAllMessages --> There was a problem opening the messages collection');
      }
    });
  },

  /**
   * Remove a message from the dataStore
   */
  this.removeMessage = function(messageId) {
    log.debug('dataStore::removeMessage --> Going to remove message with _id=' + messageId);
    this.db.collection('messages', function(err, collection) {
      if (!err) {
        collection.remove({
          _id: messageId
        }, {
          safe: true
        },

        function(err, d) {
          if (!err) {
            log.debug('datastore::removeMessage --> Message removed from MongoDB');
          }
        });
      } else {
        log.error('datastore::removeMessage --> There was a problem opening the messages collection');
      }
    });
  },

  /**
   * Recovers an operator from the dataStore
   */
  this.getOperator = function(mcc, mnc, callback) {
    var id = helpers.padNumber(mcc, 3) + '-' + helpers.padNumber(mnc, 2);
    log.debug('Looking for operator ' + id);
    // Get from MongoDB
    this.db.collection('operators', function(err, collection) {
      if (!err) {
        collection.findOne({
          '_id': id
        }, function(err, d) {
          if (!err) {
            if (d) {
              log.debug('datastore::getOperator --> The operator has been recovered. Calling callback');
              return callback(d);
            } else {
              log.debug('datastore::getOperator --> No operator found. Calling callback');
              return callback(null);
            }
          } else {
            log.debug('datastore::getOperator --> Error finding operator from MongoDB: ' + err);
            return callback(null);
          }
        });
      } else {
        log.error('datastore::getOperator --> There was a problem opening the messages collection');
        return callback(null);
      }
    });
  };
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
util.inherits(DataStore, events.EventEmitter);
var _ds = new DataStore();
_ds.init();

function getDataStore() {
  return _ds;
}

module.exports = getDataStore();
