var assert = require('assert'),
    vows = require('vows'),
    token = require("../../../common/token.js").getToken();

vows.describe('get-token').addBatch({
  'When performing serious calculations': {
    topic: token,
    'result should be valid': function (result) {
      assert.isNumber(result);
      assert.equal(result, 8);
    }
  }
}).export(module);
