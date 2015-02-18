'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var assert = require('assert'),
    vows = require('vows'),
    ser = require('../../src/ns_wakeupchecker/main.js'),
    request = require('request');

var wakeup = new ser.NS_WakeUp_Checker();
wakeup.start();

var Log = require('../../src/common/Logger.js');
Log.init('tests.log', 'NS_WakeUp_Checker test', true);

function checkReady(cb) {
  setTimeout(function() {
    cb(wakeup.dataStoreReady);
  }, 2000);
}

vows.describe('WakeUp checker').addBatch({
  'Has all methods': {
    topic: wakeup,
    'start': function(topic) {
      assert.isFunction(wakeup.start);
    },
    'stop': function(topic) {
      assert.isFunction(wakeup.stop);
    },
    'recoverNetworks': function(topic) {
      assert.isFunction(wakeup.recoverNetworks);
    },
    'checkNodes': function(topic) {
      assert.isFunction(wakeup.checkNodes);
    }
  },
  'CheckServer method': {
    'Good URL': {
      topic: function() { wakeup.checkServer('https://localhost:8090/', this.callback); },
/*
      'can reach a good URL': function(error, result) {
        assert.isNull(error);
        assert.isObject(result);
        assert.equal(result.statusCode, 200);
      },
*/
      'Dummy (a WakeUp mock is needed !) - fix me !': function() {
        assert.isTrue(true);
      }
    },
    'Bad URL': {
      topic: function() { wakeup.checkServer('http://I-DO-NOT-EXIST-OR-AT-LEAST-I-HOPE-SO.com/', this.callback); },
/*
      'cannot be reached': function(error, result) {
        assert.isNotNull(error);
        assert.isUndefined(result);
      }
*/
      'Dummy (a WakeUp mock is needed !) - fix me !': function() {
        assert.isTrue(true);
      }
    }
  },
  'Playing with functions': {
    topic: function() {
      checkReady(this.callback);
    },
    'ready': {
/*
      'yes': function(result, undf) {
        assert.isTrue(result);
      },
*/
      'recover networks': {
        topic: function() {
          wakeup.recoverNetworks(this.callback);
          setTimeout(this.callback, 3000);
        },
/*
        'check recovered networks': function(error, data) {
          assert.isNull(error);
          assert.isNotNull(data);
          assert.isArray(data);
        }
*/
      }
    }
  }
}).export(module);
