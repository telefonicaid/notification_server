/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';

var Log = require('../common/Logger.js'),
    MobileNetwork = require('../common/MobileNetwork.js'),
    request = require('request'),
    fs = require('fs'),
    config = require('../config.js').NS_WakeUp_Checker;

function NS_WakeUp_Checker() {
    this.MobileNetworkReady = false;
    this.statuses = {};
}

NS_WakeUp_Checker.prototype = {
    //////////////////////////////////////////////
    // Constructor
    //////////////////////////////////////////////

    start: function() {
        Log.info(
            'NS_WakeUpChecker:init --> Starting WakeUp local nodes checker server'
        );

        //Wait until we have setup our events listeners
        var self = this;
        MobileNetwork.once('ready', function() {
            Log.info(
                'NS_WakeUpChecker::init --> MobileNetwork ready and connected');
            self.MobileNetworkReady = true;

            // Start auto provisioning networks with wakeup available
            self.autoProvisionNetworks();

            // Check periodically the networks
            self.checkNodesInterval = setInterval(function() {
                self.checkNodes();
            }, config.checkPeriod);
        });
        MobileNetwork.once('closed', function() {
            if (self.closingCorrectly) {
                Log.info('NS_WakeUpChecker::start --> Closed MobileNetwork');
                return;
            }
            Log.critical(Log.messages.CRITICAL_DBDISCONNECTED, {
                'class': 'NS_WakeUpChecker',
                'method': 'init'
            });
            self.MobileNetworkReady = false;
            clearInterval(self.checkNodesInterval);
            this.stop();
        });
        process.nextTick(function() {
            MobileNetwork.start();
        });

        // Check if we are alive
        this.readyTimeout = setTimeout(function() {
            if (!self.MobileNetworkReady) {
                Log.critical(Log.messages.CRITICAL_NOTREADY);
            }
        }, 30 * 1000); //Wait 30 seconds
    },

    stop: function(correctly) {
        this.closingCorrectly = correctly;
        Log.info(
            'NS_WakeUpChecker::stop --> Closing WakeUp local nodes checker server'
        );
        MobileNetwork.removeAllListeners();
        MobileNetwork.stop();
        clearTimeout(this.checkNodesTimeout);
        setTimeout(function() {
            process.exit(0);
        }, 5000);
    },

    recoverNetworks: function(server, cb) {
        Log.debug('NS_WakeUpChecker:recoverNetworks -> Recovering networks from server '
            + server.name, server.status);
        var options = {
            url: server.status,
            method: 'GET',
            ca: server.ca,
            key: server.key,
            cert: server.crt,
            rejectUnauthorized: false,
            agent: false
        };

        request(options, function(error, response, body) {
            Log.info('Networks supported by this server (' + server.name + '): ', body);
            if (error || response.statusCode !== 200) {
                cb({ error: (error || response.statusCode || 'Unknown')});
            } else {
                cb(body, (response.headers && response.headers['x-tracking-id']));
            }
        });
    },

    autoProvisionNetworks: function() {
        if (!this.MobileNetworkReady) {
            return;
        }
        Log.debug('NS_WakeUpChecker:autoProvisionNetworks -> Checking WakeUp networks');
        var self = this;

        MobileNetwork.getAllWakeUps(function (error, servers) {
            if (error) {
                return;
            }
            MobileNetwork.cleanAllOperators(function() {
                servers.forEach(function(server) {
                    self.recoverNetworks(server, function(wakeUpNodes, trackingID) {
                        var json = {};
                        try {
                            json = JSON.parse(wakeUpNodes);
                        } catch (e) {
                            json.error = 'Cannot parse JSON from server';
                        }

                        if (json.error) {
                            Log.info('NS_WakeUpChecker:autoProvisionNetworks --> Some error checking ' +
                                'nodes ' + json.error);
                            return;
                        }

                        if (!json.nets || !Array.isArray(json.nets)) {
                            Log.error(
                                'NS_WakeUpChecker:autoProvisionNetworks --> Data recovered is not an array. Check backend!'
                            );
                            return;
                        }

                        (json.nets).forEach(function(node) {
                            Log.debug(
                                'NS_WakeUpChecker:autoProvisionNetworks --> Provisioning Local Proxy server',
                                node);
                            MobileNetwork.provisionOperator(node, server,
                                function provisionOperatorCB(error) {
                                    if (error) {
                                        Log.info(
                                            'NS_WakeUpChecker:autoProvisionNetworks --> Error provisioning operator: ' +
                                            error);
                                    } else {
                                        Log.info(
                                            'NS_WakeUpChecker:autoProvisionNetworks --> operator provisioned on server ' +
                                            server.name + ' -', node);
                                    }
                                });
                        });
                    });
                });
            });
        });
    },

    checkNodes: function() {
        if (!this.MobileNetworkReady) {
            return;
        }
        Log.debug('NS_WakeUpChecker:checkNodes -> Checking nodes');
        var self = this;
        MobileNetwork.getAllWakeUps(function (error, servers) {
            if (error) {
                return;
            }
            servers.forEach(function(server) {
                self.recoverNetworks(server, function(wakeUpNodes, trackingID) {
                    var json = {};
                    try {
                        json = JSON.parse(wakeUpNodes);
                    } catch (e) {
                        json.error = 'Cannot parse JSON from server';
                    }

                    if (json.error) {
                        Log.info('NS_WakeUpChecker:checkNodes --> Some error checking ' +
                            'nodes ' + json.error);
                        // We need to disable all networks with wakeup enabled since the
                        // global wakeup is down and we cannot communicate with the local
                        // wakeups :(
                        MobileNetwork.disableAllWakeups();
                        return;
                    }

                    if (!json.nets || !Array.isArray(json.nets)) {
                        Log.error(
                            'NS_WakeUpChecker:checkNodes --> Data recovered is not an array. Check backend!'
                        );
                        return;
                    }

                    (json.nets).forEach(function(node) {
                        Log.debug(
                            'NS_WakeUpChecker:checkNodes --> Checking Local Proxy server',
                            node);
                        var mcc = node.mccmnc.split('-')[0];
                        var mnc = node.mccmnc.split('-')[1];

                        // Check existentially
                        self.statuses[node.mccmnc] = self.statuses[node.mccmnc] || {};

                        if (node.offline === true) {
                            self.statuses[node.mccmnc].retries =
                                (self.statuses[node.mccmnc].retries || 0) + 1;
                        } else {
                            self.statuses[node.mccmnc].retries = 0;
                        }

                        if (self.statuses[node.mccmnc].retries === 0) {
                            Log.info(Log.messages.NOTIFY_WAKEUPSERVER_OK, {
                                mcc: mcc,
                                mnc: mnc
                            });
                        } else {
                            Log.info(Log.messages.NOTIFY_WAKEUPSERVER_KO, {
                                mcc: mcc,
                                mnc: mnc,
                                retries: self.statuses[node.mccmnc].retries
                            });
                        }
                        MobileNetwork.changeNetworkStatus(mcc, mnc, !node.offline);
                    });
                });
            });
        });
    }
};

// Exports
exports.NS_WakeUp_Checker = NS_WakeUp_Checker;
