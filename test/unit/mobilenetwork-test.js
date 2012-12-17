/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mn = require("../../src/common/mobilenetwork.js"),
    assert = require('assert'),
    vows = require('vows');

vows.describe('MobileNetwork tests').addBatch({
  'Ready.': {
    topic: function() {
      mn.callbackReady(this.callback);
    },
    'is ready': function(ready) {
      assert.isTrue(ready);
    },
    'Searching for 214-07 (came from DDBB).': {
      topic: function() {
        mn.getNetwork("214","07", this.callback);
      },
      'error is null': function(error, data, where) {
        assert.isNull(error);
      },
      'data received is an object': function(error, data, where) {
        assert.isObject(data);
      },
      'data._id is 214-07': function(error, data, where) {
        assert.equal(data._id, "214-07");
      },
      'data.country is Spain': function(error, data, where) {
        assert.equal(data.country, "Spain");
      },
      'data.operator is "Telefónica Móviles España, SAU"': function(error, data, where) {
        assert.equal(data.operator, "Telefónica Móviles España, SAU");
      },
      'data.mcc is 214': function(error, data, where) {
        assert.equal(data.mcc, "214");
      },
      'data.mnc is 07': function(error, data, where) {
        assert.equal(data.mnc, "07");
      },
      'where it comes is ddbb': function(error, data, where) {
        assert.equal(where, "ddbb");
      },
      'Searching (came from cache).': {
        topic: function() {
          mn.getNetwork("214","07", this.callback);
        },
        'error is null': function(error, data, where) {
        assert.isNull(error);
        },
        'data received is an object': function(error, data, where) {
          assert.isObject(data);
        },
        'data._id is 214-07': function(error, data, where) {
          assert.equal(data._id, "214-07");
        },
        'data.country is Spain': function(error, data, where) {
          assert.equal(data.country, "Spain");
        },
        'data.operator is "Telefónica Móviles España, SAU"': function(error, data, where) {
          assert.equal(data.operator, "Telefónica Móviles España, SAU");
        },
        'data.mcc is 214': function(error, data, where) {
          assert.equal(data.mcc, "214");
        },
        'data.mnc is 07': function(error, data, where) {
          assert.equal(data.mnc, "07");
        },
        'where it comes is cache': function(error, data, where) {
          assert.equal(where, "cache");
        },
        'Cache cleared.': {
          topic: function() {
            mn.resetCache(this.callback);
          },
          'Searching again (from DDBB).': {
            topic: function() {
              mn.getNetwork("214","07", this.callback);
            },
            'error is null': function(error, data, where) {
              assert.isNull(error);
            },
            'data received is an object': function(error, data, where) {
              assert.isObject(data);
            },
            'data._id is 214-07': function(error, data, where) {
              assert.equal(data._id, "214-07");
            },
            'data.country is Spain': function(error, data, where) {
              assert.equal(data.country, "Spain");
            },
            'data.operator is "Telefónica Móviles España, SAU"': function(error, data, where) {
              assert.equal(data.operator, "Telefónica Móviles España, SAU");
            },
            'data.mcc is 214': function(error, data, where) {
              assert.equal(data.mcc, "214");
            },
            'data.mnc is 07': function(error, data, where) {
              assert.equal(data.mnc, "07");
            },
            'where it comes is ddbb': function(error, data, where) {
              assert.equal(where, "ddbb");
            }
          }
        }
      }
    }
  }
}).addBatch({
'Ready.': {
    topic: function() {
      mn.callbackReady(this.callback);
    },
    'is ready': function(ready) {
      assert.isTrue(ready);
    },
    'Recovering non existing.': {
      topic: function() {
        mn.getNetwork("999","99", this.callback);
      },
      'error is null': function(error, data, where) {
        assert.isNull(error);
      },
      'data is null': function(error, data, where) {
        assert.isNull(error);
      },
      'where it comes is ddbb': function(error, data, where) {
        assert.equal(where, 'ddbb');
      }
    }
  }
}).addBatch({
'Ready.': {
    topic: function() {
      mn.callbackReady(this.callback);
    },
    'is ready': function(ready) {
      assert.isTrue(ready);
    },
    'Cache cleared.': {
      topic: function() {
        mn.resetCache(this.callback);
      },
      'Recovering 214-07 (testing padding).': {
        topic: function() {
          mn.getNetwork(214, 7, this.callback);
        },
        'error is null': function(error, data, where) {
          assert.isNull(error);
        },
        'data received is an object': function(error, data, where) {
          assert.isObject(data);
        },
        'data._id is 214-07': function(error, data, where) {
          assert.equal(data._id, "214-07");
        },
        'data.country is Spain': function(error, data, where) {
          assert.equal(data.country, "Spain");
        },
        'data.operator is "Telefónica Móviles España, SAU"': function(error, data, where) {
          assert.equal(data.operator, "Telefónica Móviles España, SAU");
        },
        'data.mcc is 214': function(error, data, where) {
          assert.equal(data.mcc, "214");
        },
        'data.mnc is 07': function(error, data, where) {
          assert.equal(data.mnc, "07");
        },
        'where it comes is ddbb': function(error, data, where) {
          assert.equal(where, "ddbb");
        }
      }
    }
  }
}).export(module);