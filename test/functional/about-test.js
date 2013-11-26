'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var assert = require('assert'),
    vows = require('vows'),
    request = require('request');

vows.describe('About tests').addBatch({
  'WebSocket': {
    topic: function() {
      request('https://localhost:8080/about', this.callback);
    },
    'no error and 200 as statusCode': function(error, response, body) {
      assert.isNull(error);
      assert.equal(response.statusCode, 200);
    }
  },
  'Application Server': {
    topic: function() {
      request('https://localhost:8081/about', this.callback);
    },
    'no error and 200 as statusCode': function(error, response, body) {
      assert.isNull(error);
      assert.equal(response.statusCode, 200);
    }
  },
  'UDP local': {
    topic: function() {
      request('https://localhost:8090/about', this.callback);
    },
    'no error and 200 as statusCode': function(error, response, body) {
      assert.isNull(error);
      assert.equal(response.statusCode, 200);
    }
  },
}).export(module);
