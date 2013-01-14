/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var assert = require('assert'),
    vows = require('vows'),
    token = require('../../src/common/token');
    common = require('./common');

vows.describe('Token tests').addBatch({
'Getting a token (HTTP)': {
  topic: function() {
    common.getToken(this.callback);
  },
  'result must be non-null': function(error, chunk) {
    assert.isNotNull(chunk);
  },
  'result must be a string': function(error, chunk) {
    assert.isString(chunk);
  },
  'result must be a lenght>0': function(error, chunk) {
    assert.isNotZero(chunk.length);
  },
  'must be valid': function(error, chunk) {
    assert.isTrue(token.verify(chunk));
  }
}
}).export(module);