/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mn = require("../../src/common/maintance.js"),
    assert = require('assert'),
    vows = require('vows');

vows.describe('logtraces tests').addBatch({
  "By default, maintance should be disabled": function() {
    assert.isFalse(mn.getStatus());
  },

  "Active maintance mode": function() {
    mn.active();
    assert.isTrue(mn.getStatus());
  },

  "Disable maintance mode": function() {
    mn.inactive();
    assert.isFalse(mn.getStatus());
  }
}).export(module);
