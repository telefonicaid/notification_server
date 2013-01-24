/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var assert = require('assert'),
    vows = require('vows'),
    dataStore = require('../../src/common/datastore'),
    common = require('../functional/common'),
    mongo = require('mongodb'),
    ddbbsettings = require("../../src/config.js").ddbbsettings;


var queries = {
  getNode: function(callback) {
    var collection = "nodes";
    var fun = function(self, collection) {
      console.log(collection);
    };
    dataStore.rawQuery(collection, fun, callback);
    /*collection.findOne(
      { varName: varValue },
      callback
    );*/
  }
};

vows.describe('DataStore tests').addBatch({
'Waiting for Mongo readiness for playing with registerNode().': {
  topic: function() {
    dataStore.callbackReady(this.callback);
  },
  'mongo is ready': function(topic) {
    assert.isTrue(topic);
  },
  'Inserting…': {
    topic: function() {
      dataStore.registerNode(1, 2, 3, this.callback);
    },
    'insert is OK (error is null)': function(error, data) {
      assert.isNull(error);
    },
    'data should be 1 (means inserted/updated)': function(error, data) {
      assert.equal(data, 1);
    },
    'Looking for inserted node using getNodeData()': {
      topic: function() {
	dataStore.getNodeData(1, this.callback);
      },
      'query is OK (error is null)': function(error, data) {
	assert.isNull(error);
      },
      'data retrieved is an object': function(error, data) {
	assert.isObject(data);
      },
      'data retrieved has a _id=1 attribute': function(error, data) {
	assert.equal(data._id, 1);
      },
      'data retrieved has a co=1 attribute': function(error, data) {
	assert.equal(data.co, 1);
      },
      'data retrieved has a si=2 attribute': function(error, data) {
	assert.equal(data.si, 2);
      },
      'data retrieved has a dt=3 attribute': function(error, data) {
	assert.equal(data.dt, 3);
      },
      'data retrieved has a number for lt': function(error, data) {
	assert.isNumber(data.lt);
      },
      'data retrieved for lt is bigger than 0': function(error, data) {
	assert.strictEqual(data.lt > 0, true);
      }
    }
  }
}
}).addBatch({
'Mongo is ready for playing with unregisterNode().': {
  topic: function() {
    dataStore.callbackReady(this.callback);
  },
  'result is true': function(topic) {
    assert.isTrue(topic);
  },
  'Checking previous data:': {
    topic: function() {
      dataStore.getNodeData(1, this.callback);
    },
    'all is OK': function(error, data) {
      assert.equal(error, null);
      assert.isObject(data);
      assert.equal(data._id, 1);
      assert.equal(data.co, 1);
      assert.equal(data.si, 2);
      assert.equal(data.dt, 3);
      assert.isNumber(data.lt);
      assert.strictEqual(data.lt > 0, true);
    }
  }
}
}).addBatch({
'Mongo is ready for playing with registerApplication()': {
  topic: function() {
    dataStore.callbackReady(this.callback);
  },
  'result is true': function(topic) {
    assert.isTrue(topic);
  },
  'starting…': {
    topic: function() {
      dataStore.getNodeData(1, this.callback);
    },
    'TODO': function(error, data) {
      assert.equal(error, null);
      assert.equal(data, data);
    }
  }
}

}).export(module);
