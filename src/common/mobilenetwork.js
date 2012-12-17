/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var datastore = require('./datastore.js'),
    log = require('../common/logger.js'),
    helpers = require('./helpers.js');

function MobileNetwork() {
  this.cache = {};
  this.ready = false;
  this.callbacks = [];
}

MobileNetwork.prototype = {
  callbackReady: function(callback) {
    if (this.ready) {
      callback(true);
      return;
    }
    this.callbacks.push(helpers.checkCallback(callback));
  },

  init: function() {
    this.resetCache();
    datastore.on('ddbbconnected', (function() {
      log.debug('[MobileNetwork] library loaded');
      this.ready = true;
      var callbacks = this.callbacks || [];
      callbacks.forEach(function(elem) {
        elem(true);
      });
    }).bind(this));
  },

  resetCache: function(callback) {
    this.cache = {};
    callback = helpers.checkCallback(callback);
    callback();
    log.debug('[MobileNetwork] cache cleaned');
  },

  getNetwork: function(mcc, mnc, callback) {
    callback = helpers.checkCallback(callback);

    var index = helpers.padNumber(mcc, 3) + '-' + helpers.padNumber(mnc, 2);
    var value = {};

    log.debug('[MobileNetwork] looking for MCC-MNC: ' + index);
    // Check if the network is in the cache
    if (value = this.cache[index]) {
      log.debug('[MobileNetwork] found on cache:', value);
      return callback(null, value, 'cache');
    }

    // Check if the network if it's in the database and update cache
    datastore.getOperator(mcc, mnc, function(error, d) {
      if (error) {
        log.error('[MobileNetwork] --> error!! ' + error);
        callback(error);
        return;
      }
      if (!d) {
        log.debug('[MobileNetwork] Not found on database');
        callback(null, null, 'ddbb');
        return;
      }
      log.debug('[MobileNetwork] found on database:', d);
      this.cache[index] = d;
      return callback(null, d, 'ddbb');
    }.bind(this));
  }
};


///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _mn = new MobileNetwork(); _mn.init();
function getMobileNetwork() {
  return _mn;
}

module.exports = getMobileNetwork();
