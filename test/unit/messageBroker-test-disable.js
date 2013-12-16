/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var assert = require('assert'),
    vows = require('vows'),
    msgBroker = require('../../src/common/MsgBroker'),
    common = require('../functional/common');

vows.describe('MessageBroker tests').addBatch({
  'Waiting for ready-ness': {
    topic: function() {
      msgBroker.callbackReady(this.callback);
      msgBroker.start();
      setTimeout(this.callback, 4000);
    },
    'OK': function(ready) {
      assert.isTrue(ready);
    },
    'Pub-sub1': {
      topic: function() {
        // XXX: Copy me below
        var q = 'tests';
        msgBroker.subscribe(q, {}, undefined, this.callback);
        setTimeout(function() {
          msgBroker.push(q, '{"hola" : "qué tal"}');
        }, 2000);
        setTimeout(this.callback, 4000);
      },
      'Message Received with OK parameters': function(msg, headers, deliveryInfo) {
        var q = 'tests';
        console.log(Array.prototype.slice.call(arguments, 0));
        assert.equal(msg.hola, "qué tal");
        assert.equal(deliveryInfo.contentType, "application/json");
        assert.equal(deliveryInfo.deliveryMode, 1);
        assert.equal(deliveryInfo.queue, q);
        assert.equal(deliveryInfo.exchange, q + '-fanout');
        assert.equal(deliveryInfo.routingKey, q);
      }
    },
    'Pub-sub2': {
      topic: function() {
        // XXX: Copy me below
        var q = 'tests2';
        msgBroker.subscribe(q, {}, undefined, this.callback);
        setTimeout(function() {
          msgBroker.push(q, '{"adios" : "hasta mañana"}');
        }, 2000);
        setTimeout(this.callback, 4000);
      },
      'Message Received with OK parameters': function(msg, headers, deliveryInfo) {
        var q = 'tests2';
        assert.equal(msg.adios, "hasta mañana");
        assert.equal(deliveryInfo.contentType, "application/json");
        assert.equal(deliveryInfo.deliveryMode, 1);
        assert.equal(deliveryInfo.queue, q);
        assert.equal(deliveryInfo.exchange, q + '-fanout');
        assert.equal(deliveryInfo.routingKey, q);
      }
    },
    'Pub-sub3': {
      topic: function() {
        // XXX: Copy me below
        var q = 'tests3';
        msgBroker.subscribe(q, {}, undefined, this.callback);
        setTimeout(function() {
          msgBroker.push(q, '{"hey!" : "ho! let\'s go!"}');
        }, 2000);
        setTimeout(this.callback, 4000);
      },
      'Message Received with OK parameters': function(msg, headers, deliveryInfo) {
        var q = 'tests3';
        assert.equal(msg["hey!"], "ho! let's go!");
        assert.equal(deliveryInfo.contentType, "application/json");
        assert.equal(deliveryInfo.deliveryMode, 1);
        assert.equal(deliveryInfo.queue, q);
        assert.equal(deliveryInfo.exchange, q + '-fanout');
        assert.equal(deliveryInfo.routingKey, q);
      }
    }
  }
}).export(module);
