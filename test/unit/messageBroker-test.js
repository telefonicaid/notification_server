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
    'Pub-sub': {
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
        assert.equal(msg.hola, "qué tal");
        assert.equal(deliveryInfo.contentType, "application/json");
        assert.equal(deliveryInfo.deliveryMode, 1);
        assert.equal(deliveryInfo.queue, q);
        assert.equal(deliveryInfo.exchange, q + '-fanout');
        assert.equal(deliveryInfo.routingKey, q);
      }
    }
  }
}).export(module);
