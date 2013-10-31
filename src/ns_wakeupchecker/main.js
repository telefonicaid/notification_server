/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var Log = require('../common/Logger.js'),
    DataStore = require('../common/DataStore.js'),
    MobileNetwork = require('../common/MobileNetwork.js'),
    http = require('http'),
    https = require('https'),
    urlparser = require('url'),
    checkPeriod = require('../config.js').NS_WakeUp_Checker.checkPeriod;

function NS_WakeUp_Checker() {
  this.dataStoreReady = false;
}

NS_WakeUp_Checker.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  start: function() {
    Log.info('NS_WakeUpChecker:init --> Starting WakeUp local nodes checker server');

    //Wait until we have setup our events listeners
    var self = this;
    DataStore.once('ready', function() {
      Log.info('NS_WakeUpChecker::init --> DataStore ready and connected');
      self.dataStoreReady = true;
      self.checkNodes();
    });
    DataStore.once('closed', function() {
      if (self.closingCorrectly) {
        Log.info('NS_WakeUpChecker::start --> Closed DataStore');
        return;
      }
      Log.critical(Log.messages.CRITICAL_DBDISCONNECTED, {
        'class': 'NS_WakeUpChecker',
        'method': 'init'
      });
      self.dataStoreReady = false;
      this.stop();
    });
    process.nextTick(function() {
      DataStore.start();
    });

    // Check if we are alive
    this.readyTimeout = setTimeout(function() {
      if (!self.dataStoreReady) {
        Log.critical(Log.messages.CRITICAL_NOTREADY);
      }
    }, 30 * 1000); //Wait 30 seconds
  },

  stop: function(correctly) {
    this.closingCorrectly = correctly;
    Log.info('NS_WakeUpChecker:stop --> Closing WakeUp local nodes checker server');
    DataStore.removeAllListeners();
    DataStore.stop();
    setTimeout(function() {
      process.exit(0);
    }, 5000);
  },

  recoverNetworks: function(cb) {
    DataStore.getOperatorsWithLocalNodes(function(error, d) {
      if (error) {
        Log.error(Log.messages.ERROR_MOBILENETWORKERROR, {
          'error': error
        });
        return;
      }
      if (!d) {
        Log.debug('[MobileNetwork] No local nodes found on database');
        return;
      }
      Log.debug('[MobileNetwork] Data found: ', d);
      cb(d);
    });
  },

  checkNodes: function() {
    if (!this.ddbbready) {
      return;
    }
    Log.debug('NS_WakeUpChecker:checkNodes -> Checking nodes');
    var self = this;
    this.recoverNetworks(function(wakeUpNodes){
      wakeUpNodes.forEach(function(node) {
        Log.debug('Checking Local Proxy server', node);
        self.checkServer(node.wakeup, function(err,res) {
          if (err || res.statusCode !== 200) {
            Log.info(Log.messages.NOTIFY_WAKEUPSERVER_KO, {
              country: node.country,
              mcc: node.mcc,
              mnc: node.mnc,
              retries: node.offlinecounter + 1
            });
            MobileNetwork.changeNetworkStatus(node.mcc, node.mnc, false);
          } else {
            Log.info(Log.messages.NOTIFY_WAKEUPSERVER_OK, {
              country: node.country,
              mcc: node.mcc,
              mnc: node.mnc
            });
            if (node.offline) {
              MobileNetwork.changeNetworkStatus(node.mcc, node.mnc, true);
            }
          }
        });
      });
      setTimeout(function() {
        self.checkNodes();
      }, checkPeriod);
    });
  },

  checkServer: function(url, cb) {
    // Send HTTP Notification Message
    var address = urlparser.parse(url);

    if (!address.href) {
      Log.error(Log.messages.ERROR_UDPBADADDRESS, {
        'address': address
      });
      return;
    }

    var protocolHandler = null;
    switch (address.protocol) {
    case 'http:':
      protocolHandler = http;
      break;
    case 'https:':
      protocolHandler = https;
      break;
    default:
      protocolHandler = null;
    }
    if (!protocolHandler) {
      Log.debug('NS_WakeUpChecker:checkServer --> Non valid URL (invalid protocol)');
      return;
    }
    var options = {
      hostname: address.hostname,
      port: address.port,
      path: '/status',
      agent: false
    };
    protocolHandler.get(options,
      function(res) {
        cb(null, res);
      }).on('error', function(e) {
        cb(e);
      }).end();
  }
};

// Exports
exports.NS_WakeUp_Checker = NS_WakeUp_Checker;
