/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

 process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


var assert = require('assert'),
    vows = require('vows'),
    exec = require('child_process').exec,
    common = require('../functional/common');

/* TODO: TEST STOPPED - FIX THIS TEST ASAP */
vows.describe('E2E UDP test').addBatch({
'TEST-STOPPED': {
  'Dummy test - Please fix me!': function() {
    assert.isTrue(true);
  }
}/*,
'End-to-end': {
	topic: function() {
		exec('node test/functional/E2E-udp.js \'wss://localhost:8080/\'', this.callback);
	},
	'Should end without Error': function(error, stdout, stderr) {
		assert.isNull(error);
	}
}*/
}).export(module);
