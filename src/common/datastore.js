/* jslint node: true */
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

  /*
   * MongoDB.Server => https://github.com/mongodb/node-mongodb-native/blob/1.3-dev/lib/mongodb/connection/server.js#L16
   * MongoDB.Db => https://github.com/mongodb/node-mongodb-native/blob/1.3-dev/lib/mongodb/db.js#L37
   * MongoDB.ReplSet => https://github.com/mongodb/node-mongodb-native/blob/1.3-dev/lib/mongodb/connection/repl_set.js#L24
   */
  this.init = function() {
    log.info('datastore::init --> MongoDB data store loading.');
    events.EventEmitter.call(this);

    var mongourl = (function() {
      var url = 'mongodb://';
      var servers = (ddbbsettings.machines).map(function(e) { return e[0] + ':' + e[1]}).toString();
      url += servers;
      var db = ddbbsettings.ddbbname || '';
      url += '/' + db;
      log.info('datastore::init --> Going to connect to -- ' + url);
      return url;
    })();

    var options = {
      db: {},
      server: {
        socketOptions: {
          keepAlive: 1
        }
      },
      replSet: {
        socketOptions: {
          keepAlive: 1
        }
      },
      mongos: {
        socketOptions: {
          keepAlive: 1
        }
      }
    };

    var self = this;
    mongodb.MongoClient.connect(mongourl, options, function(err, db) {
      if (err) {
        log.critical(log.messages.CRITICAL_DBCONNECTIONERROR, {
          "class": 'datastore',
          "method": 'starting',
          "error": err
        });
        self.close();
        return;
      }
      self.db = db;
      log.info('datastore::init --> Connected to MongoDB on ' + ddbbsettings.machines +
               '. Database Name: ' + ddbbsettings.ddbbname);
      self.emit('ddbbconnected');
      self.ready = true;
      var callbacks = self.callbacks || [];
      callbacks.forEach(function(elem) {
        elem(true);
      });
    });
  },

  this.close = function() {
    log.info('datastore::close --> Closing connection to DB');
    this.db.close();
    this.emit('ddbbdisconnected');
    this.ready = false;
  },

  this.registerNode = function(uaid, serverId, data, callback) {
    var self = this;
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'registerNode',
          "error": err
        });
        callback(err);
        return;
      }
      //We could use a $setOnInsert (only available on MongoDB 2.4)
      //http://docs.mongodb.org/manual/reference/operator/setOnInsert/#op._S_setOnInsert
      self.getNodeData(uaid, function(error, d) {
        if (error) {
          callback(error);
          return;
        }
        var ch = (d && d.ch) || [];
        collection.findAndModify(
          { _id: uaid },
          [],
          {
            $set: {
              si: serverId,
              dt: data,
              ch: ch,
              co: connectionstate.CONNECTED,
              lt: new Date()
            }
          },
          { safe: true, upsert: true },
          function(err, res) {
            if (err) {
              log.error(log.messages.ERROR_DSERRORINSERTINGNODEINDB, {
                "error": err
              });
              callback(err);
              return;
            }
            log.debug('dataStore::registerNode --> Node inserted/updated ', uaid);
            callback(null, res, data);
            return;
          }
        );
      });
    });
  },

  /**
   * Unregister a node
   */
   this.unregisterNode = function(uaid, queue, fullyDisconnected, callback) {
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'unregisterNode',
          "error": err
        });
        callback(err);
        return;
      }
      collection.findAndModify(
        {
          _id: uaid,
          si: queue
        },
        [],
        {
          $set: {
            co: fullyDisconnected,
            lt: new Date()
          }
        },
        { safe: true },
        function(err, data) {
          if (err) {
            log.error(log.messages.ERROR_DSERRORREMOVINGNODE, {
              "error": err
            });
            return callback(err);
          }
          log.debug('datastore::unregisterNode --> Node removed from MongoDB');
          return callback(null, data);
        }
      );
    });
   },

  /**
   * Gets a node - server relationship
   */
  this.getNodeData = function(uaid, callback) {
    log.debug('datastore::getNodeData --> Finding info for node ' + uaid);
    // Get from MongoDB
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'getNodeData',
          "error": err
        });
        callback(err);
        return;
      }
      collection.findOne({ _id: uaid }, function(err, data) {
      if (err) {
          log.error(log.messages.ERROR_DSERRORFINDINGNODE, {
            "error": err
          });
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
        collection.findAndModify(
          { _id: appToken },
          [],
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
              log.error(log.messages.ERROR_DSERRORINSERTINGAPPINDB, {
                "error": err
              });
            } else {
              log.debug('datastore::registerApplication --> Application inserted into MongoDB');
            }
          });
      } else {
        log.error(log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
          "method": 'registerApplication',
          "error": err
        });
      }
    });
    this.db.collection('nodes', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'registerApplication',
          "error": err
        });
        callback(err);
        return;
      }
      collection.findAndModify(
        { _id: uaid },
        [],
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
            log.error(log.messages.ERROR_DSERRORINSERTINGMSGTONODE, {
              "method": 'registerApplication',
              "error": err
            });
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
    callback = helpers.checkCallback(callback);
    this.db.collection('apps', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
          "method": 'unregisterApplication',
          "error": err
        });
        return;
      }
      collection.findAndModify(
        { _id: appToken },
        [],
        { $pull:
          {
            no: uaid
          }
        },
        { safe: true },
        function(err, data) {
          if (err) {
            log.error(log.messages.ERROR_DSUNDETERMINEDERROR, {
              "error": err
            });
            return callback(err);
          }
          if (!data) {
            log.debug('dataStore::unregisterApplication --> appToken not found');
            return callback(-1);
          }
          log.debug('dataStore::unregisterApplication --> Deleted node from apps collection');
        }
      );
    });

    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'unregisterApplication',
          "error": err
        });
        return;
      }
      collection.findAndModify(
        {
          _id: uaid,
          "ch.app": appToken
        },
        [],
        {
          $pull:
            {
              "ch": {
                "app": appToken
              }
            }
        },
        function(err,data) {
          if (err) {
            log.debug('datastore::unregisterApplication --> Error removing apptoken from the nodes: ' + err);
            return callback(err);
          }
          log.debug('datastore::unregisterApplication --> Application removed from node data');
          return callback(null);
        }
      );
    });

    //Remove the appToken if the nodelist (no) is empty
    this.removeApplicationIfEmpty(appToken);
  },

  this.removeApplicationIfEmpty = function(appToken) {
    this.db.collection('apps', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
          "method": 'removeApplicationIfEmpty',
          "error": err
        });
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
        log.error(log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
          "method": 'getApplicationsForUA',
          "error": err
        });
        callback(err);
      }
      collection.findOne(
        { _id: uaid },
        { _id: false, ch: true },
        function(err, data) {
          if (err) {
            log.error(log.messages.ERROR_DSERRORFINDINGAPPS, {
              "error": err
            });
            return callback(err);
          }
          if (data && data.ch && data.ch.length) {
            log.debug('datastore::getApplicationsOnUA --> Applications recovered, calling callback');
            callback(null, data.ch);
          } else {
            log.debug('datastore::getApplicationsOnUA --> No applications recovered :(');
            callback(null, []);
          }
        }
      );
    });
  },

  /**
   * Gets an application node list
   */
  this.getApplication = function(appToken, callback, json) {
    log.debug('datastore::getApplication --> Going to find application with appToken: ' + appToken);
    var self = this;
    this.db.collection('apps', function(err, apps) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
          "method": 'getApplication',
          "error": err
        });
        callback(err);
        return;
      }
      apps.findOne(
        { _id: appToken },
        { _id: false, no: true },
        function(err, data) {
          if (err) {
            log.error(log.messages.ERROR_DSERRORFINDINGAPP, {
              "error": err
            });
            callback(err);
            return;
          }
          // Safe checks
          // Also, we only care if the data.no is just one. We should not allow
          // register more than one node for each appToken… but that's another
          // story…
          if (!data || !Array.isArray(data.no) || data.no.length !== 1 || !data.no[0]) {
            log.error('Not enough data or invalid: ', data);
            return;
          }
          self.db.collection('nodes', function(err, nodes) {
            if (err) {
              log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                "method": 'newVersion',
                "error": err
              });
              callback(err);
              return;
            }
            nodes.findOne(
              { _id: data.no[0] },
              {
                _id: true,
                co: true,
                si: true,
                dt: true
              },
              function(err, data) {
                if (err) {
                  log.error(log.messages.ERROR_DSERRORFINDINGNODE, {
                    "error": err
                  });
                  callback(err);
                  return;
                }
                log.debug('datastore::getApplication --> Application found');
                var msg = data ? 'Application found, have callback, calling' : 'No app found, calling callback';
                log.debug('datastore::getApplication --> ' + msg, data);
                // Convert it to an Array.
                callback(null, [data], json);
              }
            );
          });
        }
      );
    });
  },

  this.getInfoForAppToken = function(apptoken, callback) {
    apptoken = apptoken.toString();
    log.debug('datastore::getInfoForAppToken --> Going to find the info for the appToken ' + apptoken);
    this.db.collection('apps', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
          "method": 'getInfoForAppToken',
          "error": err
        });
        callback(err);
        return;
      }
      collection.findOne({ _id: apptoken }, function(err, data) {
        if (err) {
          log.error(log.messages.ERROR_DSERRORFINDINGCERTIFICATE, {
            "method": 'getInfoForAppToken',
            "error": err
          });
          callback(err);
          return;
        }
        if (!data) {
          log.debug('datastore::getInfoForAppToken --> There are no appToken=' + apptoken + ' in the DDBB');
          callback(null, null);
          return;
        }
        callback(null, data);
      });
    });
  },

  /**
   * Save a new message
   * @return New message as stored on DB.
   */
  this.newVersion = function(nodeId, appToken, channelID, version) {
    var msg = {};
    msg.app = appToken;
    msg.ch = channelID;
    msg.vs = version;

    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'newVersion',
          "error": err
        });
        return;
      }
      collection.findAndModify(
        {
          _id: nodeId,
          "ch.app" : appToken
        },
        [],
        { $set:
          {
            "ch.$.vs" : version,
            "ch.$.new" : 1
          }
        },
        function(error, data) {
          if (err) {
            log.error(log.messages.ERROR_DSERRORSETTINGNEWVERSION, {
              "apptoken": appToken
            });
            return;
          }
          log.debug('dataStore::newVersion --> Version updated');
        }
      );
    });
    return msg;
  },

  /**
   * This ACKs a message by putting a "new" flag to 0 on the node, on the channelID ACKed
   *
   */
  this.ackMessage = function(uaid, channelID, version) {
    log.debug('dataStore::ackMessage --> Going to ACK message from uaid=' + uaid + ' for channelID=' + channelID + ' and version=' + version);
    this.db.collection('nodes', function(error, collection) {
      if (error) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'ackMessage',
          "error": error
        });
        return;
      }
      collection.findAndModify(
        {
          _id: uaid,
          'ch.ch': channelID
        },
        [],
        {
          $set: {
            'ch.$.new': 0
          }
        },
        function(err,d) {
          if (err) {
            log.error(log.messages.ERROR_DSERRORACKMSGINDB, {
              "error": err
            });
            return;
          }
        }
      );
    });
  },

  /**
   * Recovers an operator from the dataStore
   */
  this.getOperator = function(mcc, mnc, callback) {
    var id = helpers.padNumber(mcc, 3) + '-' + helpers.padNumber(mnc, 3);
    log.debug('Looking for operator ' + id);
    // Get from MongoDB
    this.db.collection('operators', function(err, collection) {
      callback = helpers.checkCallback(callback);
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGOPERATORSCOLLECTION, {
          "method": 'getOperator',
          "error": err
        });
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

  this.getUDPClientsAndUnACKedMessages = function(callback) {
    callback = helpers.checkCallback(callback);
    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'getUDPClientsAndUnACKedMessages',
          "error": err
        });
        callback(err);
        return;
      }
      collection.find(
        {
          "dt.protocol": "udp",
          "ch": {
            $elemMatch: {
              "new": 1
            }
          }
        },
        {
          _id: true,
          si: true,
          dt: true
        }
      ).toArray(function(err, nodes) {
        if (err) {
          log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
            "method": 'getUDPClientsAndUnACKedMessages',
            "error": err
          });
          callback(err);
          return;
        }
        if(!nodes.length) {
          callback(null, null);
        }
        log.debug('dataStore::getUDPClientsAndUnACKedMessages --> Data found.')
        callback(null, nodes);
      });
    });
  },

  this.flushDb = function() {
    this.db.collection('apps', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
          "method": 'flushDb',
          "error": err
        });
        return;
      }
      collection.remove({}, function(err, removed) {
      if (err) {
        log.error(log.messages.ERROR_DSERRORREMOVINGXXXCOLLECTION, {
          "collection": 'apps',
          "error": err
        });
        return;
      }
      });
    });
    this.db.collection('nodes', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
          "method": 'flushDb',
          "error": err
        });
        return;
      }
      collection.remove({}, function(err, removed) {
      if (err) {
        log.error(log.messages.ERROR_DSERRORREMOVINGXXXCOLLECTION, {
          "collection": 'nodes',
          "error": err
        });
        return;
      }
      });
    });
    this.db.collection('operators', function(err, collection) {
      if (err) {
        log.error(log.messages.ERROR_DSERROROPENINGOPERATORSCOLLECTION, {
          "method": 'flushDb',
          "error": err
        });
        return;
      }
      collection.remove({}, function(err, removed) {
      if (err) {
        log.error(log.messages.ERROR_DSERRORREMOVINGXXXCOLLECTION, {
          "collection": 'operators',
          "error": err
        });
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
