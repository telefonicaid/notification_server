/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var lt = require("../../src/common/logtraces.js"),
    assert = require('assert'),
    vows = require('vows');

vows.describe('logtraces tests').addBatch({
  "Well formed log traces": function() {
    Object.keys(lt.logtraces).forEach(function(k) {
      assert.isNumber(lt.logtraces[k].id);
      assert.isString(lt.logtraces[k].m);
      if (lt.logtraces[k].doc) {
        assert.isString(lt.logtraces[k].doc);
      }
    });
  },

  "Unique log IDs": function() {
    var aux = [];
    Object.keys(lt.logtraces).forEach(function(k) {
      if (aux[lt.logtraces[k].id]) {
        console.log(' >>>> Repeated log trace ID: ' + lt.logtraces[k].id.toString(16));        
      }
      assert.isUndefined(aux[lt.logtraces[k].id]);
      aux[lt.logtraces[k].id] = true;
    });
  }
}).export(module);
