'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var assert = require('assert'),
    vows = require('vows'),
    datamanager = require('../../src/ns_ua/DataManager.js');

datamanager.start();

var Log = require('../../src/common/Logger.js');
Log.init('tests.log', 'DataManager test', true);

function checkReady(cb) {
  setTimeout(function() {
    cb(datamanager.ready);
  }, 2000);
}

vows.describe('DataManager').addBatch({
  'Has all methods': {
    topic: datamanager,
    'start': function(topic) {
      assert.isFunction(datamanager.start);
    },
    'stop': function(topic) {
      assert.isFunction(datamanager.stop);
    },
    'registerNode': function(topic) {
      assert.isFunction(datamanager.registerNode);
    },
    'unregisterNode': function(topic) {
      assert.isFunction(datamanager.unregisterNode);
    },
    'getNodeConnector': function(topic) {
      assert.isFunction(datamanager.getNodeConnector);
    },
    'getNodeData': function(topic) {
      assert.isFunction(datamanager.getNodeData);
    },
    'registerApplication': function(topic) {
      assert.isFunction(datamanager.registerApplication);
    },
    'unregisterApplication': function(topic) {
      assert.isFunction(datamanager.unregisterApplication);
    },
    'getApplicationsForUA': function(topic) {
      assert.isFunction(datamanager.getApplicationsForUA);
    },
    'ackMessage': function(topic) {
      assert.isFunction(datamanager.ackMessage);
    }
  },
  'Playing with functions': {
    topic: function() {
      checkReady(this.callback);
    },
    'ready': {
      'yes': function(topic) {
        assert.isTrue(topic);
      }/*,
      'recover networks': {
        topic: function() {
          wakeup.recoverNetworks(this.callback);
          setTimeout(this.callback, 3000);
        },
        'check recovered networks': function(data, undf) {
          assert.isNotNull(data);
          assert.isArray(data);
        }
      }*/
    }
  }
}).export(module);
