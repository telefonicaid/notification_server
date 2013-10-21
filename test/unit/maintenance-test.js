/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mn = require("../../src/common/maintenance.js"),
    assert = require('assert'),
    vows = require('vows');

vows.describe('logtraces tests').addBatch({
  "By default, maintenance should be disabled": function() {
    assert.isFalse(mn.getStatus());
  },

  "Active maintenance mode": function() {
    mn.active();
    assert.isTrue(mn.getStatus());
  },

  "Disable maintenance mode": function() {
    mn.inactive();
    assert.isFalse(mn.getStatus());
  }
}).export(module);
