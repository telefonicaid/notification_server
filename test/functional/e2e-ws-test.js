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

vows.describe('E2E WS test').addBatch({
'End-to-end': {
	topic: function() {
		exec('node test/functional/E2E-ws.js \'wss://localhost:8080/\'', this.callback);
	},
	'Should end without Error': function(error, stdout, stderr) {
		assert.isNull(error);
	}
}
}).export(module);
