/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var hp = require("../../src/common/Helpers.js"),
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
  },
  'isIPInNetwork': {
    '192.168.1.11 in 192.168.1.0/24': function() {
      assert.isTrue(hp.isIPInNetwork('192.168.1.11', ['192.168.1.0/24']));
    },
    '127.0.0.1 in 0.0.0.0/1': function() {
      assert.isTrue(hp.isIPInNetwork('127.0.0.1', ['0.0.0.0/1']));
    },
    '10.4.5.6 in 10.0.0.0/8': function() {
      assert.isTrue(hp.isIPInNetwork('10.4.5.6', ['10.0.0.0/8']));
    },
    'null in 192.168.1.0/8': function() {
      assert.isFalse(hp.isIPInNetwork(null, ['192.168.1.0/8']));
    },
    '"" in 192.168.1.0/8': function() {
      assert.isFalse(hp.isIPInNetwork("", ['192.168.1.0/8']));
    },
    'a in 192.168.1.0/8': function() {
      assert.isFalse(hp.isIPInNetwork('a', ['192.168.1.0/8']));
    },
    '10.1.1.1 in 192.168.1.0/24 or 10.0.0.0/8': function() {
      assert.isTrue(hp.isIPInNetwork('10.1.1.1', ['192.168.1.0/24', '10.0.0.0/8']));
    },
    '10.1.1.1 in []': function() {
      assert.isTrue(hp.isIPInNetwork('10.1.1.1', []));
    },
    '10.1.1.1 in NOT in 192.168.1.0/24': function() {
      assert.isFalse(hp.isIPInNetwork('10.1.1.1', ['192.168.1.0/24']));
    },
    '10.1.1.1 in NOT in 192.168.1.0/24 or 11.0.0.0/8 but on 10.0.0.0/8': function() {
      assert.isTrue(hp.isIPInNetwork('10.1.1.1', ['192.168.1.0/24', '11.0.0.0/8', '10.0.0.0/8']));
    }
  }
}).export(module);
