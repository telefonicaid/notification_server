/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mongodb = require('mongodb'),
    log = require('./logger.js'),
    events = require('events'),
    util = require('util'),
    ddbbsettings = require('../config.js').ddbbsettings,
    helpers = require('../common/helpers.js'),
    connectionstate = require('../common/constants.js').connectionstate;

var DataStore = function() {
  this.callbackReady = function(callback) {
    if (this.ready) {
      callback(true);
      return;
    }
    if (!this.callbacks) {
      this.callbacks = [];
    }
    this.callbacks.push(helpers.checkCallback(callback));
  },

  this.init = function() {
    log.info('datastore::starting --> MongoDB data store loading.');
    events.EventEmitter.call(this);

    if (ddbbsettings.replicasetName) {
      //Filling the replicaset data
      var servers = [];
      ddbbsettings.machines.forEach(function(machine) {
        servers.push(new mongodb.Server(machine[0], machine[1], { auto_reconnect: true }));
      });
      var replSet = new mongodb.ReplSetServers(servers,
        {
          rs_name: ddbbsettings.replicasetName,
          read_secondary: true,
          w: 1
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
            w: 1
          }
        )
      );
    }

    // Establish connection to db
    this.db.open(function(err, db) {
      if (err) {
        log.critical('datastore::starting --> Error connecting to MongoDB ! - ' + err);
        this.close();
        return;
      }
      log.info('datastore::starting --> Connected to MongoDB on ' + ddbbsettings.machines + '. Database Name: ' + ddbbsettings.ddbbname);
      this.emit('ddbbconnected');
      this.ready = true;
      var callbacks = this.callbacks || [];
      callbacks.forEach(function(elem) {
        elem(true);
      });
    }.bind(this));
  },

  this.close = function() {
    log.info('datastore::close --> Closing connection to DB');
    this.db.close();
    this.emit('ddbbdisconnected');
    this.ready = false;
  },

  this.registerNode = function(uaid, serverId, data, callback) {
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::registerNode --> There was a problem opening the nodes collection -- ' + err);
        callback(err);
        return;
      }
      collection.update(
        { _id: uaid },
        {
          $set: {
            si: serverId,
            dt: data,
            co: connectionstate.CONNECTED,
            lt: parseInt(new Date().getTime() / 1000 , 10) // save as seconds
          }
        },
        { safe: true, upsert: true },
        function(err, data) {
          if (err) {
            log.error('datastore::registerNode --> Error inserting/updating node into MongoDB -- ' + err);
            callback(err);
            return;
          }
          log.debug('dataStore::registerNode --> Node inserted/updated ', uaid);
          callback(null, data, uaid);
          return;
        }
      );
    });
  };

  /**
   * Unregister a node
   */
   this.unregisterNode = function(uaid, fullyDisconnected, callback) {
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::unregisterNode --> There was a problem opening the nodes collection: ' + err);
        callback(err);
        return;
      }
      collection.update(
        { _id: uaid },
        {
          $set: {
            co: fullyDisconnected,
            lt: parseInt(new Date().getTime() / 1000 , 10) // save as seconds
          }
        },
        { safe: true },
        function(err, data) {
          if (err) {
            log.error('dataStore::unregisterNode --> There was a problem removing the node: ' + err);
            return callback(err);
          }
          log.debug('datastore::unregisterNode --> Node removed from MongoDB');
          return callback(null, data);
        }
      );
    });
   };

  /**
   * Gets a node - server relationship
   */
  this.getNodeData = function(uaid, callback) {
    log.debug('datastore::getNodeData --> Finding info for node ' + uaid);
    // Get from MongoDB
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::getNodeData --> there was a problem opening the nodes collection: ' + err);
        callback(err);
        return;
      }
      collection.findOne({ _id: uaid }, function(err, data) {
      if (err) {
        log.error('datastore::getNodeData --> Error finding node into MongoDB: ' + err);
          callback(err);
          return;
        }
        var msg = data ? 'Data found, calling callback with data' : 'Node not found';
        log.debug('datastore::getNodeData --> ' + msg);
        callback(null, data);
      });
    });
  },

  /**
   * Register a new application
   */
  this.registerApplication = function(appToken, channelID, uaid, cert, callback) {
    // Store in MongoDB
    this.db.collection('apps', function(err, collection) {
      if (!err) {
        collection.update(
          { _id: appToken },
          { $set:
            {
              ce: cert,
              ch: channelID
            },
            $addToSet:
            {
              no: uaid
            }
          },
          { safe: true, upsert: true },
          function(err, data) {
            if (err) {
              log.error('datastore::registerApplication --> Error inserting application into MongoDB: ' + err);
            } else {
              log.debug('datastore::registerApplication --> Application inserted into MongoDB');
            }
          });
      } else {
        log.error('datastore::registerApplication --> there was a problem opening the apps collection: ' + err);
      }
    });
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('dataStore::registerApplication --> Error opening nodes collection: ' + err);
        callback(err);
        return;
      }
      collection.update(
        { _id: uaid },
        {
          $addToSet: {
            ch: {
              ch: channelID,
              app: appToken
            }
          }
        },
        { safe: true, upsert: true },
        function(err, data) {
          if (err) {
            log.error('dataStore::registerApplication --> Error inserting message to node: ' + err);
            callback(err);
            return;
          }
          log.debug('dataStore::registerApplication --> Message inserted');
          callback(null, data);
        }
      );
    });
  },

  /**
   * Unregister an old application
   */
  this.unregisterApplication = function(appToken, uaid, callback) {
    // Remove from MongoDB
    this.db.collection('apps', function(err, collection) {
      if (err) {
        log.error('dataStore::unregisterApplication --> Error opening apps collection');
        return;
      }
      collection.update(
        { _id: appToken },
        { $pull:
          {
            no: uaid
          }
        },
        { safe: true },
        function(err, data) {
          if (err) {
            log.error('dataStore::unregisterApplication --> Some error occured ' + err);
            return;
          }
          log.debug('dataStore::unregisterApplication --> Deleted node from apps collection');
        }
      );
    });

    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::unregisterApplication --> there was a problem opening the nodes collection: ' + err);
        callback(err);
        return;
      }
      collection.update(
        { _id: uaid },
        { $pull:
          {
            "ch.ch": appToken
          }
        },
        { safe: true },
        function(err, data) {
          if (err) {
            log.debug('datastore::unregisterApplication --> Error removing apptoken from the nodes: ' + err);
            return callback(err);
          }
          log.debug('datastore::unregisterApplication --> Application removed from node data');
          return callback(null, data);
        });
    });

    //Remove the appToken if the nodelist (no) is empty
    this.removeApplicationIfEmpty(appToken);
  },

  this.removeApplicationIfEmpty = function(appToken) {
    this.db.collection('apps', function(err, collection) {
      if (err) {
        log.error('datastore::removeApplicationIfEmpty --> there was a problem opening the apps collection: ' + err);
        return;
      }
      collection.findAndModify(
        {
          _id: appToken,
          no: { $size: 0 }
        },
        [], //Sort
        {}, //Replacement
        {
          safe: false,
          remove: true //Remove document
        },
        function(err, data) {
          if (err) {
            log.debug('datastore::removeApplicationIfEmpty --> Error removing application from apps: ' + err);
          }
        }
      );
    });
  },

  /**
   * Recover a list of WA associated to a UA
   */
  this.getApplicationsForUA = function(uaid, callback) {
    // Get from MongoDB
    log.debug('datastore::getApplicationsOnUA --> Going to find applications in UA: ' + uaid);
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::getApplicationsForUA --> there was a problem opening the apps collection');
        callback(err);
      }
      collection.find(
        { _id: uaid },
        { ch: true }
      ).toArray(function(err, data) {
        if (err) {
          log.error('datastore::getApplicationsForUA --> Error finding applications from MongoDB: ' + err);
          return callback(err);
        }
        if (data.length) {
          log.debug('datastore::getApplicationsOnUA --> Applications recovered, calling callback');
          callback(null, data);
        } else {
          log.debug('datastore::getApplicationsOnUA --> No applications recovered :(');
          callback(null, null);
        }
      });
    });
  },

  /**
   * Gets an application node list
   */
  this.getApplication = function(appToken, callback, json) {
    // Get from MongoDB
    log.debug('datastore::getApplication --> Going to find application with appToken: ' + appToken);
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::getApplication --> there was a problem opening the apps collection');
        callback(err);
        return;
      }
      collection.find(
        {
          "ch.app": appToken
        },
        {
          _id: true,
          co: true,
          si: true,
          dt: true
        }
      ).toArray(function(err, data) {
        if (err) {
          log.error('datastore::getApplication --> Error finding application from MongoDB: ' + err);
          callback(err);
          return;
        }
        log.debug('datastore::getApplication --> Application found');
        var msg = data ? 'Application found, have callback, calling' : 'No app found, calling callback';
        log.debug('datastore::getApplication --> ' + msg, data);
        callback(null, data, json);
      });
    });
  },

  /**
   * Get the Certificate of the WA.
   * @ return the public certificate.
   */
  this.getCertificateApplication = function(channeID, callback) {
    var channeID = channeID.toString();
    log.debug('datastore::getCertificateApplication --> Going to find the certificate for the channeID ' + channeID);
    this.db.collection('apps', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::getCertificateApplication --> there was a problem opening the apps collection: ' + err);
        callback(err);
        return;
      }
      collection.findOne({ _id: channeID }, function(err, data) {
        if (err) {
          log.error('datastore::getCertificateApplication --> There was a problem finding the certificate - ' + err);
          callback(err);
          return;
        }
        if (!data) {
          log.debug('There are no channeID=' + channeID + ' in the DDBB');
          callback(null, null);
          return;
        }
        if (data.ce) {
          var ce = data.ce;
          log.debug("datastore::getCertificateApplication --> Found the certificate '" + ce.s + "' for the channeID '" + channeID);
          callback(null, ce);
        } else {
          log.debug('datastore::getCertificateApplication --> There are no certificate for the channeID ' + channeID);
          callback('No certificate for the channeID=' + channeID);
        }
      });
    });
  },

  this.getChannelIDForAppToken = function(apptoken, callback) {
    var apptoken = apptoken.toString();
    log.debug('datastore::getChannelIDForAppToken --> Going to find the certificate for the appToken ' + apptoken);
    this.db.collection('apps', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::getChannelIDForAppToken --> there was a problem opening the apps collection: ' + err);
        callback(err);
        return;
      }
      collection.findOne({ _id: apptoken }, function(err, data) {
        if (err) {
          log.error('datastore::getChannelIDForAppToken --> There was a problem finding the certificate - ' + err);
          callback(err);
          return;
        }
        if (!data) {
          log.debug('There are no appToken=' + apptoken + ' in the DDBB');
          callback(null, null);
          return;
        }
        callback(null, data.ch);
      });
    });
  },

  /**
   * Save a new message
   * @return New message as stored on DB.
   */
  this.newMessage = function(id, apptoken, msg) {
    //Modify the original msg, adding messageId (a unique uuid_v1) and the url notified (probably unique)
    msg.messageId = id;
    msg.appToken = apptoken;

    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error('datastore::newMessage --> There was a problem opening the nodes collection: ' + err);
        return;
      }
      collection.findAndModify(
        { ch: apptoken },
        [],
        {
        $addToSet: {
            ms: msg
          }
        },
        function(err, data) {
          if (err) {
            log.error('dataStore::newMessage --> Error inserting message to node: ' + err);
          } else {
            log.debug('dataStore::newMessage --> Message inserted');
          }
        }
      );
    });
    return msg;
  },

  /**
   * Save a new message
   * @return New message as stored on DB.
   */
  this.newVersion = function(appToken, channelID, version) {
    var msg = {};
    msg.app = appToken;
    msg.ch = channelID;
    msg.vs = version;

    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error('datastore::newVersion --> There was a problem opening the nodes collection: ' + err);
        return;
      }
      collection.findAndModify(
        //Find any sub-object on chs array that ch contains channelID
        { "ch.ch": channelID },
        [],
        { $push:
          {
            ch: msg
          }
        },
        function(err, data) {
          if (err) {
            log.error('dataStore::newVersion --> Error updating version for node: ' + err);
          } else {
            log.debug('dataStore::newVersion --> Version updated');
          }
        }
      );
    });
    return msg;
  },

  /**
   * Get all messages for a UA
   */
  this.getAllMessagesForUA = function(uaid, callback) {
    log.debug('Looking for messages of ' + uaid);
    // Get from MongoDB
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::getAllMessagesForUA --> There was a problem opening the messages collection: ' + err);
        callback(err);
        return;
      }
      collection.find(
        { _id: uaid },
        { ms: true }
      ).toArray(function(err, data) {
        if (err) {
          log.error('datastore::getAllMessagesForUA --> There was a problem finding the message: ' + err);
          callback(err);
          return;
        }
        if (data.length) {
          log.debug('datastore::getAllMessagesForUA --> Messages found, calling callback');
          callback(null, data);
        } else {
          log.debug('datastore::getAllMessagesForUA --> No messages found, calling callback');
          callback(null, null);
        }
      });
    });
  },

  /**
   * Remove a message from the dataStore
   */
  this.removeMessage = function(messageId, uaid) {
    log.debug('dataStore::removeMessage --> Going to remove message with _id=' + messageId + 'for the uaid=' + uaid);
    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error('datastore::removeMessage --> There was a problem opening the messages collection');
        return;
      }
      collection.update(
        {
          _id: uaid
        },
        { $pull:
          {
            ms:
              {
                'messageId': messageId
              }
          }
        },
        { safe: true },
        function(err, d) {
          if (err) {
            log.error('dataStore::removeMessage --> Error removing message', err);
            return;
          }
          log.notify('datastore::removeMessage --> Message removed from MongoDB ' + messageId);
        }
      );
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
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error('datastore::getOperator --> There was a problem opening the operators collection');
        callback(err);
        return;
      }
      collection.findOne({ '_id': id }, function(err, data) {
        if (err) {
          log.debug('datastore::getOperator --> Error finding operator from MongoDB: ' + err);
          callback(err);
          return;
        }
        var msg = data ? 'The operator has been recovered. ' : 'No operator found. ';
        log.debug('datastore::getOperator --> ' + msg + ' Calling callback');
        return callback(null, data);
      });
    });
  },

  this.flushDb = function() {
    this.db.collection('apps', function(err, collection) {
      if (err) {
        log.error('datastore::flushDb --> There was a problem opening the apps collection');
        return;
      }
      collection.remove({}, function(err, removed) {
      if (err) {
        log.error('datastore::flushDb --> There was a problem removing the apps collection');
        return;
      }
      });
    });
    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error('datastore::flushDb --> There was a problem opening the nodes collection');
        return;
      }
      collection.remove({}, function(err, removed) {
      if (err) {
        log.error('datastore::flushDb --> There was a problem removing the nodes collection');
        return;
      }
      });
    });
    this.db.collection('operators', function(err, collection) {
      if (err) {
        log.error('datastore::flushDb --> There was a problem opening the operators collection');
        return;
      }
      collection.remove({}, function(err, removed) {
      if (err) {
        log.error('datastore::flushDb --> There was a problem removing the operators collection');
        return;
      }
      });
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
