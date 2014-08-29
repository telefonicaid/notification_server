/* jshint node:true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var mongodb = require('mongodb'),
    Log = require('./Logger.js'),
    events = require('events'),
    util = require('util'),
    ddbbsettings = require('../config.js').ddbbsettings,
    Helpers = require('./Helpers.js'),
    connectionstate = require('../common/constants.js').connectionstate;

var DataStore = function() {
    this.db = null;
    var self = this;
    events.EventEmitter.call(this);

    this.callbackReady = function(callback) {
        if (this.ready) {
            callback(true);
            return;
        }
        if (!this.callbacks) {
            this.callbacks = [];
        }
        this.callbacks.push(Helpers.checkCallback(callback));
    };

    this.start = function() {
        Log.info('datastore::init --> MongoDB data store loading.');

        var mongourl = (function() {
            var url = 'mongodb://';
            url += (ddbbsettings.machines).map(
                function(e) {
                    return e[0] + ':' + e[1];
                }
            ).toString();
            url += '/' + (ddbbsettings.ddbbname || '');
            Log.info('datastore::init --> Going to connect to -- ' + url);
            return url;
        })();

        var options = {
            db: {},
            server: {
                socketOptions: {
                    keepAlive: 1000
                }
            },
            replSet: {
                socketOptions: {
                    keepAlive: 1000
                }
            },
            mongos: {
                socketOptions: {
                    keepAlive: 1000
                }
            }
        };

        mongodb.MongoClient.connect(mongourl, options, function(err, db) {
            if (err) {
                Log.critical(Log.messages.CRITICAL_DBCONNECTIONERROR, {
                    'class': 'datastore',
                    'method': 'starting',
                    'error': err
                });
                self.stop();
                return;
            }
            self.db = db;
            Log.info('datastore::init --> Connected to MongoDB on ' + ddbbsettings.machines +
                '. Database Name: ' + ddbbsettings.ddbbname);

            /**
             * FIXME: Check https://jirapdi.tid.es/browse/OWD-30308 for more info
             */
            var events = ['close']; //, 'error'];
            events.forEach(function(e) {
                db.on(e, function() {
                    self.emit('closed');
                });
            });

            self.emit('ready');
            self.ready = true;
            var callbacks = self.callbacks || [];
            callbacks.forEach(function(elem) {
                elem(true);
            });
        });
    };

    this.stop = function() {
        Log.info('datastore::close --> Closing connection to DB');
        if (this.db && this.db.close) {
            this.db.close();
        }
        this.emit('closed');
        this.ready = false;
    };

    this.registerNode = function(uaid, serverId, data, callback) {
        this.db.collection('nodes', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'registerNode',
                    'error': err
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
                collection.findAndModify({
                        _id: uaid
                    }, [], {
                        $set: {
                            si: serverId,
                            dt: data,
                            ch: ch,
                            co: connectionstate.CONNECTED,
                            lt: new Date()
                        }
                    }, {
                        safe: true,
                        upsert: true
                    },
                    function(err, res) {
                        if (err) {
                            Log.error(Log.messages.ERROR_DSERRORINSERTINGNODEINDB, {
                                'error': err
                            });
                            callback(err);
                            return;
                        }
                        Log.debug('dataStore::registerNode --> Node inserted/updated ', uaid);
                        callback(null, res, data);
                    }
                );
            });
        });
    };

    this.unregisterNode = function(uaid, queryFrom, newQueue, fullyDisconnected,
        callback) {
        this.db.collection('nodes', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'unregisterNode',
                    'error': err
                });
                callback(err);
                return;
            }
            collection.findAndModify({
                    _id: uaid,
                    si: queryFrom
                }, [], {
                    $set: {
                        co: fullyDisconnected,
                        lt: new Date(),
                        si: newQueue
                    }
                }, {
                    safe: true
                },
                function(err, data) {
                    if (err) {
                        Log.error(Log.messages.ERROR_DSERRORREMOVINGNODE, {
                            'error': err
                        });
                        return callback(err);
                    }
                    Log.debug('datastore::unregisterNode --> Node removed from MongoDB');
                    return callback(null, data);
                }
            );
        });
    };

    this.getNodeData = function(uaid, callback) {
        Log.debug('datastore::getNodeData --> Finding info for node ' + uaid);
        // Get from MongoDB
        this.db.collection('nodes', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'getNodeData',
                    'error': err
                });
                callback(err);
                return;
            }
            collection.findOne({
                _id: uaid
            }, function(err, data) {
                if (err) {
                    Log.error(Log.messages.ERROR_DSERRORFINDINGNODE, {
                        'error': err
                    });
                    callback(err);
                    return;
                }
                var msg = data ?
                    'Data found, calling callback with data' :
                    'Node not found';
                Log.debug('datastore::getNodeData --> ' + msg);
                callback(null, data);
            });
        });
    },

    /**
     * Register a new application
     */
    this.registerApplication = function(appToken, channelID, uaid, callback) {
        // Store in MongoDB
        this.db.collection('apps', function(err, collection) {
            if (!err) {
                collection.findAndModify({
                        _id: appToken
                    }, [], {
                        $set: {
                            ch: channelID
                        },
                        $addToSet: {
                            no: uaid
                        }
                    }, {
                        safe: true,
                        upsert: true
                    },
                    function(err) {
                        if (err) {
                            Log.error(Log.messages.ERROR_DSERRORINSERTINGAPPINDB, {
                                'error': err
                            });
                        } else {
                            Log.debug(
                                'datastore::registerApplication --> Application inserted into MongoDB'
                            );
                        }
                    });
            } else {
                Log.error(Log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
                    'method': 'registerApplication',
                    'error': err
                });
            }
        });
        this.db.collection('nodes', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'registerApplication',
                    'error': err
                });
                callback(err);
                return;
            }
            collection.findAndModify({
                    _id: uaid
                }, [], {
                    $addToSet: {
                        ch: {
                            ch: channelID,
                            app: appToken
                        }
                    },
                    $set: {
                        lt: new Date()
                    }
                }, {
                    safe: true,
                    upsert: true
                },
                function(err, data) {
                    if (err) {
                        Log.error(Log.messages.ERROR_DSERRORINSERTINGMSGTONODE, {
                            'method': 'registerApplication',
                            'error': err
                        });
                        callback(err);
                        return;
                    }
                    Log.debug(
                        'dataStore::registerApplication --> Message inserted'
                    );
                    callback(null, data);
                }
            );
        });
    };

    /**
     * Unregister an old application
     */
    this.unregisterApplication = function(appToken, uaid, callback) {
        // Remove from MongoDB
        callback = Helpers.checkCallback(callback);
        this.db.collection('apps', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
                    'method': 'unregisterApplication',
                    'error': err
                });
                return;
            }
            collection.findAndModify({
                    _id: appToken
                }, [], {
                    $pull: {
                        no: uaid
                    }
                }, {
                    safe: true
                },
                function(err, data) {
                    if (err) {
                        Log.error(Log.messages.ERROR_DSUNDETERMINEDERROR, {
                            'error': err
                        });
                        callback(err);
                        return;
                    }
                    if (!data) {
                        Log.debug(
                            'dataStore::unregisterApplication --> appToken not found'
                        );
                        callback(-1);
                        return;
                    }
                    Log.debug(
                        'dataStore::unregisterApplication --> Deleted node from apps collection'
                    );
                }
            );
        });

        this.db.collection('nodes', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'unregisterApplication',
                    'error': err
                });
                return;
            }
            collection.findAndModify({
                    _id: uaid,
                    'ch.app': appToken
                }, [], {
                    $pull: {
                        'ch': {
                            'app': appToken
                        }
                    },
                    $set: {
                        lt: new Date()
                    }
                }, {},
                function(err, data) {
                    if (err) {
                        Log.debug(
                            'datastore::unregisterApplication --> Error removing apptoken from the nodes: ' +
                            err);
                        return callback(err);
                    }
                    Log.debug(
                        'datastore::unregisterApplication --> Application removed from node data'
                    );
                    return callback(null);
                }
            );
        });

        //Remove the appToken if the nodelist (no) is empty
        this.removeApplicationIfEmpty(appToken);
    };

    this.removeApplicationIfEmpty = function(appToken) {
        this.db.collection('apps', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
                    'method': 'removeApplicationIfEmpty',
                    'error': err
                });
                return;
            }
            collection.findAndModify({
                    _id: appToken,
                    no: {
                        $size: 0
                    }
                }, [], //Sort
                {}, //Replacement
                {
                    safe: false,
                    remove: true //Remove document
                },
                function(err) {
                    if (err) {
                        Log.debug(
                            'datastore::removeApplicationIfEmpty --> Error removing application from apps: ' +
                            err);
                    }
                }
            );
        });
    };

    this.getApplicationsForUA = function(uaid, callback) {
        // Get from MongoDB
        Log.debug(
            'datastore::getApplicationsOnUA --> Going to find applications in UA: ' +
            uaid);
        this.db.collection('nodes', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
                    'method': 'getApplicationsForUA',
                    'error': err
                });
                callback(err);
            }
            collection.findOne({
                    _id: uaid
                }, {
                    _id: false,
                    ch: true
                },
                function(err, data) {
                    if (err) {
                        Log.error(Log.messages.ERROR_DSERRORFINDINGAPPS, {
                            'error': err
                        });
                        callback(err);
                        return;
                    }
                    if (data && data.ch && data.ch.length) {
                        Log.debug(
                            'datastore::getApplicationsOnUA --> Applications recovered, calling callback'
                        );
                        callback(null, data.ch);
                    } else {
                        Log.debug(
                            'datastore::getApplicationsOnUA --> No applications recovered :('
                        );
                        callback(null, []);
                    }
                }
            );
        });
    };

    /**
     * Gets an application node list
     */
    this.getApplication = function(appToken, callback, json) {
        Log.debug(
            'datastore::getApplication --> Going to find application with appToken: ' +
            appToken);
        this.db.collection('apps', function(err, apps) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
                    'method': 'getApplication',
                    'error': err
                });
                callback(err);
                return;
            }
            apps.findOne({
                    _id: appToken
                }, {
                    _id: false,
                    no: true
                },
                function(err, data) {
                    if (err) {
                        Log.error(Log.messages.ERROR_DSERRORFINDINGAPP, {
                            'error': err
                        });
                        callback(err);
                        return;
                    }
                    // Safe checks
                    // Also, we only care if the data.no is just one. We should not allow
                    // register more than one node for each appToken… but that's another
                    // story…
                    if (!data || !Array.isArray(data.no) ||
                        data.no.length !== 1 || !data.no[0]) {
                        Log.error('Not enough data or invalid: ', data);
                        return;
                    }
                    self.db.collection('nodes', function(err, nodes) {
                        if (err) {
                            Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                                'method': 'newVersion',
                                'error': err
                            });
                            callback(err);
                            return;
                        }
                        nodes.findOne({
                                _id: data.no[0]
                            }, {
                                _id: true,
                                co: true,
                                si: true,
                                dt: true
                            },
                            function(err, data) {
                                if (err) {
                                    Log.error(Log.messages.ERROR_DSERRORFINDINGNODE, {
                                        'error': err
                                    });
                                    callback(err);
                                    return;
                                }
                                Log.debug(
                                    'datastore::getApplication --> Application found'
                                );
                                var msg = data ?
                                    'Application found, have callback, calling' :
                                    'No app found, calling callback';
                                Log.debug(
                                    'datastore::getApplication --> ' +
                                    msg, data);
                                // Convert it to an Array.
                                callback(null, [data], json);
                            }
                        );
                    });
                }
            );
        });
    };

    this.getInfoForAppToken = function(apptoken, callback) {
        apptoken = apptoken.toString();
        Log.debug(
            'datastore::getInfoForAppToken --> Going to find the info for the appToken ' +
            apptoken);
        this.db.collection('apps', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
                    'method': 'getInfoForAppToken',
                    'error': err
                });
                callback(err);
                return;
            }
            collection.findOne({
                _id: apptoken
            }, function(err, data) {
                if (err) {
                    Log.error(Log.messages.ERROR_DSERRORFINDINGCERTIFICATE, {
                        'method': 'getInfoForAppToken',
                        'error': err
                    });
                    callback(err);
                    return;
                }
                if (!data) {
                    Log.debug(
                        'datastore::getInfoForAppToken --> There are no appToken=' +
                        apptoken + ' in the DDBB');
                    callback(null, null);
                    return;
                }
                callback(null, data);
            });
        });
    };

    /**
     * Save a new message
     * @return New message as stored on DB.
     */
    this.newVersion = function(nodeId, appToken, channelID, version) {
        var msg = {};
        msg.app = appToken;
        msg.ch = channelID;
        msg.vs = version;
        msg.no = nodeId;

        this.db.collection('nodes', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'newVersion',
                    'error': err
                });
                return;
            }
            collection.findAndModify({
                    _id: nodeId,
                    'ch.app': appToken
                }, [], {
                    $set: {
                        'ch.$.vs': version,
                        'ch.$.new': 1
                    }
                }, {},
                function(error) {
                    if (error) {
                        Log.error(Log.messages.ERROR_DSERRORSETTINGNEWVERSION, {
                            'apptoken': appToken,
                            'error': error
                        });
                        return;
                    }
                    Log.debug('dataStore::newVersion --> Version updated');
                }
            );
        });
        return msg;
    };

    /**
     * This ACKs a message by putting a 'new' flag to 0 on the node, on the channelID ACKed
     *
     */
    this.ackMessage = function(uaid, channelID, version) {
        Log.debug('dataStore::ackMessage --> Going to ACK message from uaid=' +
            uaid + ' for channelID=' + channelID + ' and version=' + version);
        this.db.collection('nodes', function(error, collection) {
            if (error) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'ackMessage',
                    'error': error
                });
                return;
            }
            collection.findAndModify({
                    _id: uaid,
                    'ch.ch': channelID
                }, [], {
                    $set: {
                        'ch.$.new': 0,
                        lt: new Date()
                    }
                }, {},
                function(err) {
                    if (err) {
                        Log.error(Log.messages.ERROR_DSERRORACKMSGINDB, {
                            'error': err
                        });
                    }
                }
            );
        });
    },

    /**
     * Recovers all the wakeup platforms with access from the dataStore
     */
    this.getWakeUps = function(callback) {
        Log.debug('dataStore::getWakeUps --> Looking for all wakeups...');
        this.db.collection('wakeup', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if(err) {
                Log.error('datastore::getWakeUps - Error getting collection: ' + err);
                callback(err);
                return;
            }
            collection.find().toArray(function(err, data) {
                if (err) {
                    Log.error('datastore::getWakeUps - Error getting data: ' + err);
                    callback(err);
                    return;
                }
                var msg = data ? 'The wakeup server list has been recovered. ' :
                    'No operator found. ';
                Log.debug('datastore::getWakeUps --> ' + msg +
                    ' Calling callback');
                callback(null, data);
            });
        });
    };

    /**
     * Drop operators collection from Mongo
     */
    this.cleanAllOperators = function(callback) {
        var self = this;
        this.db.collection('operators', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if(err) {
                Log.error('datastore::cleanAllOperators - Error getting collection: ' + err);
                callback(err);
                return;
            }
            collection.drop(function(err) {
                if (err) {
                    Log.info('datastore::cleanAllOperators - Error dropping collection: ' + err);
                    Log.debug('datastore::cleanAllOperators - Creating new one');
                    self.createOperatorsCollection();
                    callback(err);
                    return;
                }
                Log.debug('datastore::cleanAllOperators - Done !');
                self.createOperatorsCollection();
                callback(null);
            });
        });
    };

    this.createOperatorsCollection = function() {
        Log.debug('datastore::createOperatorsCollection - Creating new operators collection');
        this.db.createCollection('operators', function(err, collection) {
            if (err) {
                Log.error('datastore::createOperatorsCollection - error: ' + err);
                return;
            }
            Log.debug('datastore::createOperatorsCollection - Created new collection ');
        });
    }

    /**
     * Provision a new operator into Mongo
     */
    this.provisionOperator = function(operator, wakeup) {
        Log.debug('datastore::provisionOperator - Provision operator from wakeup server ' +
            wakeup.name + ' - ', operator);
        this.db.collection('operators', function(err, collection) {
            if(err) {
                Log.error('datastore::provisionOperator - Error getting collection: ' + err);
                return;
            }
            collection.insert({
                _id: operator.mccmnc,
                netid: operator.netid,
                mccmnc: operator.mccmnc,
                range: operator.range,
                protocols: operator.protocols,
                offline: operator.offline,
                wakeup: wakeup
            },function(err) {
                if (err) {
                    Log.info('datastore::provisionOperator - Error dropping collection: ' + err);
                    Log.debug('datastore::provisionOperator - Creating new one');
                    self.createOperatorsCollection();
                    return;
                }
                Log.debug('datastore::provisionOperator - Done !');
                self.createOperatorsCollection();
            });
        });
    };

    /**
     * Recovers an operator from the dataStore
     */
    this.getOperator = function(mcc, mnc, callback) {
        var id = mcc + '-' + mnc;
        Log.debug('datastore::getOperator --> Looking for operator ' + id);
        // Get from MongoDB
        this.db.collection('operators', function(err, collection) {
            callback = Helpers.checkCallback(callback);
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGOPERATORSCOLLECTION, {
                    'method': 'getOperator',
                    'error': err
                });
                callback(err);
                return;
            }
            collection.findOne({
                '_id': id
            }, function(err, data) {
                if (err) {
                    Log.debug(
                        'datastore::getOperator --> Error finding operator from MongoDB: ' +
                        err);
                    callback(err);
                    return;
                }
                var msg = data ? 'The operator has been recovered. ' :
                    'No operator found. ';
                Log.debug('datastore::getOperator --> ' + msg +
                    ' Calling callback');
                callback(null, data);
            });
        });
    };

    this.getOperatorsWithLocalNodes = function(callback) {
        callback = Helpers.checkCallback(callback);
        Log.debug(
            'datastore::getOperatorsWithLocalNodes --> Looking for operators with a wakeup local node'
        );
        // Get from MongoDB
        this.db.collection('operators', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGOPERATORSCOLLECTION, {
                    'method': 'getOperatorsWithLocalNodes',
                    'error': err
                });
                callback(err);
                return;
            }
            collection.find({
                'wakeup': {
                    $ne: null
                }
            }).toArray(function(err, data) {
                if (err) {
                    Log.debug(
                        'datastore::getOperatorsWithLocalNodes --> Error finding operators from MongoDB: ' +
                        err);
                    callback(err);
                    return;
                }
                var msg = data ?
                    'The operators list has been recovered. ' :
                    'No operators found. ';
                Log.debug('datastore::getOperatorsWithLocalNodes --> ' +
                    msg + ' Calling callback');
                callback(null, data);
            });
        });
    };

    this.changeLocalServerStatus = function(index, online, callback) {
        callback = Helpers.checkCallback(callback);
        Log.debug(
            'datastore::changeLocalServerStatus --> Changing status of a wakeup local server: ',
            index);
        // Get from MongoDB
        this.db.collection('operators', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGOPERATORSCOLLECTION, {
                    'method': 'changeLocalServerStatus',
                    'error': err
                });
                callback(err);
                return;
            }
            var op = null;
            if (online) {
                op = {
                    $set: {
                        offline: !online,
                        offlinecounter: 0
                    }
                };
            } else {
                op = {
                    $set: {
                        offline: !online
                    },
                    $inc: {
                        offlinecounter: 1
                    }
                };
            }
            collection.findAndModify({
                    '_id': index
                }, [],
                op, {
                    safe: true,
                    upsert: true
                },
                function(err, res) {
                    if (err) {
                        Log.error(Log.messages.ERROR_DSERRORINSERTINGNODEINDB, {
                            'error': err
                        });
                        callback(err);
                        return;
                    }
                    Log.debug(
                        'dataStore::changeLocalServerStatus --> Local server updated ',
                        res);
                });
        });
    };

    this.getUDPClientsAndUnACKedMessages = function(callback) {
        callback = Helpers.checkCallback(callback);
        Log.debug('Getting UDP clients with unACKed messages');
        this.db.collection('nodes', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'getUDPClientsAndUnACKedMessages',
                    'error': err
                });
                callback(err);
                return;
            }
            collection.find({
                'dt.protocol': 'udp',
                'ch': {
                    $elemMatch: {
                        'new': 1
                    }
                }
            }, {
                _id: true,
                si: true,
                dt: true,
                ch: true
            }).toArray(function(err, nodes) {
                if (err) {
                    Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                        'method': 'getUDPClientsAndUnACKedMessages',
                        'error': err
                    });
                    callback(err);
                    return;
                }
                if (!nodes.length) {
                    callback(null, null);
                    return;
                }
                Log.debug(
                    'dataStore::getUDPClientsAndUnACKedMessages --> Data found.'
                );
                callback(null, nodes);
            });
        });
    };

    this.flushDb = function() {
        this.db.collection('apps', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGAPPSCOLLECTION, {
                    'method': 'flushDb',
                    'error': err
                });
                return;
            }
            collection.remove({}, function(err) {
                if (err) {
                    Log.error(Log.messages.ERROR_DSERRORREMOVINGXXXCOLLECTION, {
                        'collection': 'apps',
                        'error': err
                    });
                }
            });
        });
        this.db.collection('nodes', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGNODESCOLLECTION, {
                    'method': 'flushDb',
                    'error': err
                });
                return;
            }
            collection.remove({}, function(err) {
                if (err) {
                    Log.error(Log.messages.ERROR_DSERRORREMOVINGXXXCOLLECTION, {
                        'collection': 'nodes',
                        'error': err
                    });
                }
            });
        });
        this.db.collection('operators', function(err, collection) {
            if (err) {
                Log.error(Log.messages.ERROR_DSERROROPENINGOPERATORSCOLLECTION, {
                    'method': 'flushDb',
                    'error': err
                });
                return;
            }
            collection.remove({}, function(err) {
                if (err) {
                    Log.error(Log.messages.ERROR_DSERRORREMOVINGXXXCOLLECTION, {
                        'collection': 'operators',
                        'error': err
                    });
                }
            });
        });
    };
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
util.inherits(DataStore, events.EventEmitter);
var _ds = new DataStore();

function getDataStore() {
    return _ds;
}

module.exports = getDataStore();
