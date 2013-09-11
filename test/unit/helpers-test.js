/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var hp = require("../../src/common/helpers.js"),
    assert = require('assert'),
    vows = require('vows'),
    baseURL = require('../../src/config.js').consts.publicBaseURL;

vows.describe('Helper tests').addBatch({
  "getNotificationURL": function() {
    var token = Date.now();
    var url = hp.getNotificationURL(token);
    assert.isString(url);
    assert.equal(url, baseURL + '/notify/' + token);
  },
  "getAppToken": function() {
    var apptoken = hp.getAppToken("DummyToken","DummyKey");
    assert.isString(apptoken);
    assert.equal(apptoken,
      'd0e1c9740c5bafe851749d66a40f4744b7bd4c4ee4798560315dbe75ac6f9365');
  },
  "padNumber": function() {
    assert.isString(hp.padNumber(1,2));
    assert.equal(hp.padNumber(5,3), '005');
    assert.equal(hp.padNumber(10,3), '010');
    assert.equal(hp.padNumber(10,2), '10');
    assert.equal(hp.padNumber(10,1), '10');
    assert.equal(hp.padNumber(10,0), '10');
    assert.equal(hp.padNumber(536,5), '00536');
  },
  "checkCallback": function() {
    assert.isFunction(hp.checkCallback(function() {}));
    assert.isFunction(hp.checkCallback({}));
    assert.isFunction(hp.checkCallback([]));
    assert.isFunction(hp.checkCallback(null));
    assert.isFunction(hp.checkCallback(1234567890));
    assert.isFunction(hp.checkCallback('1234567890'));
  },
  "getMaxFileDescriptors": {
    topic: function() {
      hp.getMaxFileDescriptors(this.callback);
    },
    "getMaxFileDescriptors ok": function(err, filedesc) {
      assert.isString(filedesc);
      assert.isNull(err);
    }
  },
  "isVersion": function() {
    assert.isTrue(hp.isVersion(0));
    assert.isTrue(hp.isVersion(1));
    assert.isFalse(hp.isVersion(-1));
    assert.isTrue(hp.isVersion(9007199254740991));
    assert.isFalse(hp.isVersion(9007199254740992));
    assert.isFalse(hp.isVersion('hello'));
    assert.isTrue(hp.isVersion('0'));
    assert.isTrue(hp.isVersion('1'));
    assert.isFalse(hp.isVersion('-1'));
    assert.isTrue(hp.isVersion('9007199254740991'));
    assert.isFalse(hp.isVersion('9007199254740992'));
    assert.isFalse(hp.isVersion(null));
  },
  "getCaChannel": function() {
    assert.isArray(hp.getCaChannel());
  }
}).export(module);
