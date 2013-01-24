/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var assert = require('assert'),
    vows = require('vows'),
    common = require('../functional/common');

function createNotification(id, message, signature, ttl, timestamp, priority) {
  return '{"messageType": "notification", "id": "' + id + '", "message":"' + message + '", "signature":"' + signature + '", "ttl":' + ttl + ', "timestamp":"' + timestamp + '", "priority":"' + priority +'"}';
}

/*************************** Notifications **************************/
//Header: 453, body: {status: "ERROR", reason: "Not signed"}
var not_incorrect_1 = createNotification(1234, "Hola1", "", 1234, 123, 1);
//Header: 455, body: {"status":":"ERROR", "reason":"Bad signature, dropping notification"}
var not_incorrect_2 = createNotification("abc1234", "Hola hola", null, 1, 1);
//Direct notifications
var not_incorrect_3 = '{"messageType": "je suis a notification", "id": 1234, "message": "Hola", "signature": "", "ttl": 0, "timestamp": "SINCE_EPOCH_TIME", "priority": 1}';
  //there is no id
var not_incorrect_4 = '{"messageType": "notification", "id": "", "message": "Hola", "signature": "sdfasdf", "ttl": 0, "timestamp": "SINCE_EPOCH_TIME", "priority": 1}';
  //Completely malformed
var not_incorrect_5 = 'Hey, ho! Let\'s go!';

function sendNotification(id, callback) {
  common.sendNotification("https://localhost:8081/notify/blahblah", id, callback);
}

// TESTS //
vows.describe('Notification tests').addBatch({
  'Notification 1': {
    topic: function() {
      sendNotification(not_incorrect_1, this.callback);
    },
    'response should have a status: "ERROR", reason: "Not signed" response': function(error, header, chunk) {
      var res = JSON.parse(chunk);
      assert.equal(res.status, 'ERROR');
      assert.equal(res.reason, 'Not signed');
    },
    'response should have a 453 header': function(error, header, chunk) {
      assert.equal(header, 453);
    }
  },
  'Notification 2': {
    topic: function() {
      sendNotification(not_incorrect_2, this.callback);
    },
    'response should have a status: "ERROR", reason: "Bad signature, dropping notification" response': function(error, header, chunk) {
      var res = JSON.parse(chunk);
      assert.equal(res.status, 'ERROR');
      assert.equal(res.reason, 'Bad signature, dropping notification');
    },
    'response should have a 455 header': function(error, header, chunk) {
      assert.equal(header, 455);
    }
  },
  'Notification 3': {
    topic: function() {
      sendNotification(not_incorrect_3, this.callback);
    },
    'response should have a status: "ERROR", reason: "Not messageType=notification" response': function(error, header, chunk) {
      var res = JSON.parse(chunk);
      assert.equal(res.status, 'ERROR');
      assert.equal(res.reason, 'Not messageType=notification');
    },
    'response should have a 452 header': function(error, header, chunk) {
      assert.equal(header, 452);
    }
  },
  'Notification 4': {
    topic: function() {
      sendNotification(not_incorrect_4, this.callback);
    },
    'response should have a status: "ERROR", reason: "Not id" response': function(error, header, chunk) {
      var res = JSON.parse(chunk);
      assert.equal(res.status, 'ERROR');
      assert.equal(res.reason, 'Not id');
    },
    'response should have a 454 header': function(error, header, chunk) {
      assert.equal(header, 454);
    }
  },
  'Notification 5': {
    topic: function() {
      sendNotification(not_incorrect_5, this.callback);
    },
    'response should have a status: "ERROR", reason: "JSON not valid error" response': function(error, header, chunk) {
      var res = JSON.parse(chunk);
      assert.equal(res.status, 'ERROR');
      assert.equal(res.reason, 'JSON not valid error');
    },
    'response should have a 450 header': function(error, header, chunk) {
      assert.equal(header, 450);
    }
  }
}).export(module);
