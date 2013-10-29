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

function sendNotification(url, id, callback) {
  common.sendSimplePushV1Notification(url, id, callback);
}

/*
  1) Send version ('version=4 in the body)
    a) String --> fail (404)
    b) Object --> fail (404)
    c) Number < 0 --> fail (404)
  2) Lenght < 3 in path (v1/notify) --> fail (404)
  3) Is not (/v1/blah/blah) --> fail (400) !! ¿?
  4) Is not (/v1/notify/blah) --> fail (404)
  5) Body is not ('version=<number>') --> fail (404)
  6) Everything is correct --> 200
*/

// TESTS //
vows.describe('SimplePush v1 PUT tests').addBatch({
  'Valid URLs to PUT': {
    'Send a /foo/bar':{
      topic: function() {
        sendNotification('https://localhost:8081/foo/bar', 'version=1', this.callback);
      },
      'response should be 400': function(error, header) {
        assert.equal(header, 400);
      }
    },
    'Send a /v1/foo/bar':{
      topic: function() {
        sendNotification('https://localhost:8081/v1/foo/bar', 'version=1', this.callback);
      },
      'response should be 400': function(error, header) {
        assert.equal(header, 400);
      }
    }
  },
  'Valid versions to PUT': {
    'Send a version={}':{
      topic: function() {
        sendNotification('https://localhost:8081/v1/notify/bar', 'version={}', this.callback);
      },
      'response should be 400': function(error, header) {
        assert.equal(header, 400);
      }
    },
    'Send a version=s0meT3xt':{
      topic: function() {
        sendNotification('https://localhost:8081/v1/notify/bar', 'version=s0meT3xt', this.callback);
      },
      'response should be 400': function(error, header) {
        assert.equal(header, 400);
      }
    },
    'Send a version=-1':{
      topic: function() {
        sendNotification('https://localhost:8081/v1/notify/bar', 'version=-1', this.callback);
      },
      'response should be 400': function(error, header) {
        assert.equal(header, 400);
      }
    },
    'Send a version=0':{
      topic: function() {
        sendNotification('https://localhost:8081/v1/notify/bar', 'version=0', this.callback);
      },
      'response should be 200': function(error, header) {
        assert.equal(header, 200);
      }
    },
    'Send a version=NaN':{
      topic: function() {
        sendNotification('https://localhost:8081/v1/notify/bar', 'version=NaN', this.callback);
      },
      'response should be 400': function(error, header) {
        assert.equal(header, 400);
      }
    },
    'Send a version=3':{
      topic: function() {
        sendNotification('https://localhost:8081/v1/notify/bar', 'version=3', this.callback);
      },
      'response should be 200': function(error, header) {
        assert.equal(header, 200);
      }
    }
  }
}).export(module);
