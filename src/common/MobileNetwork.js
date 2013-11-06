/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var consts = require('../config.js').consts,
    DataStore = require('./DataStore.js'),
    Log = require('./Logger.js'),
    Helpers = require('./Helpers.js');

function MobileNetwork() {
  this.cache = {};
  this.ready = false;
  this.callbacks = [];
  this.isCacheEnabled = consts.MOBILENETWORK_CACHE;
}

MobileNetwork.prototype = {

  getIndex: function(mcc, mnc) {
    return Helpers.padNumber(mcc, 3) + '-' + Helpers.padNumber(mnc, 3);
  },

  callbackReady: function(callback) {
    if (this.ready) {
      callback(true);
      return;
    }
    this.callbacks.push(Helpers.checkCallback(callback));
  },

  start: function() {
    this.resetCache();
    DataStore.once('ready', (function() {
      Log.debug('MobileNetwork::start --> library loaded');
      this.ready = true;
      var callbacks = this.callbacks || [];
      callbacks.forEach(function(elem) {
        elem(true);
      });
    }).bind(this));
    process.nextTick(function() {
      DataStore.start();
    })
  },

  resetCache: function(callback) {
    this.cache = {};
    callback = Helpers.checkCallback(callback);
    callback();
    Log.debug('MobileNetwork::resetCache --> cache cleaned');
  },

  getNetwork: function(mcc, mnc, callback) {
    callback = Helpers.checkCallback(callback);

    var index = this.getIndex(mcc, mnc);
    var value;

    Log.debug('MobileNetwork::getNetwork --> looking for MCC-MNC: ' + index);
    // Check if the network is in the cache
    if (this.isCacheEnabled && (value = this.cache[index])) {
      Log.debug('MobileNetwork::getNetwork --> found on cache:', value);
      callback(null, value, 'cache');
      return;
    }

    // Check if the network if it's in the database and update cache
    var self = this;
    DataStore.getOperator(mcc, mnc, function(error, d) {
      if (error) {
        Log.error(Log.messages.ERROR_MOBILENETWORKERROR,{
          'error': error
        });
        callback(error);
        return;
      }
      if (!d) {
        Log.debug('MobileNetwork::getNetwork --> Not found on database');
        callback(null, null, 'ddbb');
        return;
      }
      Log.debug('MobileNetwork::getNetwork --> found on database:', d);
      /*
        Save to the cache the found value.
       */
      if (self.isCacheEnabled) {
        self.cache[index] = d;
      }
      callback(null, d, 'ddbb');
    });
  },

  changeNetworkStatus: function(mcc, mnc, online) {
    var index = this.getIndex(mcc,mnc);
    Log.debug('MobileNetwork::changeNetworkStatus --> ' + index + ' is ' + online);
    DataStore.changeLocalServerStatus(index, online);
  }
};


///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _mn = new MobileNetwork();
_mn.start();
function getMobileNetwork() {
  return _mn;
}

module.exports = getMobileNetwork();
