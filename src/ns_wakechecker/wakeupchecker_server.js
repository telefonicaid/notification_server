/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js'),
    datastore = require('../common/datastore.js'),
    mn = require('../common/mobilenetwork.js'),
    http = require('http'),
    https = require('https'),
    urlparser = require('url');


function server() {
  this.ddbbready = false;
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    log.info('NS_WakeUpChecker:init --> Starting WakeUp local nodes checker server');

    //Wait until we have setup our events listeners
    var self = this;
    datastore.once('ddbbconnected', function() {
      log.info('NS_WakeUpChecker::init --> DataStore ready and connected');
      self.ddbbready = true;
      self.checkNodes();
    });
    datastore.on('ddbbdisconnected', function() {
      log.critical(log.messages.CRITICAL_DBDISCONNECTED, {
        "class": 'NS_WakeUpChecker',
        "method": 'init'
      });
      self.ddbbready = false;
    });
    process.nextTick(function() {
      datastore.init();
    });

    // Check if we are alive
    this.readyTimeout = setTimeout(function() {
      if (!self.ddbbready)
        log.critical(log.messages.CRITICAL_NOTREADY);
    }, 30 * 1000); //Wait 30 seconds
  },

  stop: function() {
    log.info('NS_WakeUpChecker:stop --> Closing WakeUp local nodes checker server');
  },

  recoverNetworks: function(cb) {
    var self = this;
    datastore.getOperatorsWithLocalNodes(function(error, d) {
      if (error) {
        log.error(log.messages.ERROR_MOBILENETWORKERROR, {
          'error': error
        });
      }
      if (!d) {
        log.debug('[MobileNetwork] No local nodes found on database');
        return;
      }
      log.debug('[MobileNetwork] Data found: ', d);
      cb(d);
    });
  },

  checkNodes: function() {
    if (!this.ddbbready) {
      return;
    }
    log.debug('NS_WakeUpChecker:checkNodes -> Checking nodes');
    var self = this;
    this.recoverNetworks(function(wakeUpNodes){
      wakeUpNodes.forEach(function(node) {
        log.debug('NS_WakeUpChecker:checkNodes: Checking node: ', node);
        self.checkServer(node.wakeup, function(err,res) {
          if (err || res.statusCode != 200) {
            log.debug('Disabling node ', node);
            mn.changeNetworkStatus(node.mcc, node.mnc, false);
          } else {
            if (node.offline) {
              log.debug('Enabling node ', node);
              mn.changeNetworkStatus(node.mcc, node.mnc, true);
            }
          }
        });
      });
      setTimeout(function() {
        self.checkNodes();
      }, 1000);
    });
  },

  checkServer: function(url, cb) {
    // Send HTTP Notification Message
    var address = urlparser.parse(url);

    if (!address.href) {
      log.error(log.messages.ERROR_UDPBADADDRESS, {
        "address": address
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
      log.debug('NS_WakeUpChecker:checkServer --> Non valid URL (invalid protocol)');
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
exports.server = server;
