/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var assert = require('assert'),
    vows = require('vows'),
    exec = require('child_process').exec,
    common = require('../functional/common');

vows.describe('E2E test').addBatch({
'End-to-end': {
	topic: function() {
		exec('node test/functional/E2E.js', this.callback);
	},
	'Should end without Error': function(error, stdout, stderr) {
		assert.isNull(error);
	}
}
}).export(module);
