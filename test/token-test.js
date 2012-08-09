var assert = require('assert'),
    vows = require('vows'),
    token = require("../src/common/token.js").getToken();

//Internal vars
var NUM_TOKENS = 50000;
//Get a lot of tokens
function getTokens() {
  var tokens = [];
  for (var i = NUM_TOKENS; i >= 0; i--) {
    tokens.push(token.get());
  }
  return tokens;
}

function allDifferents(l) {
  var obj = {};
  for (var i = 0, item; item = l[i]; i++) {
    if (obj[item]) return false;
    obj[item] = 1;
  }
  return true;
}

// TESTS //
vows.describe('Token tests').addBatch({
  /**
   * Test to ask for a token. Check length
   */
  'Getting a token': {
    topic: token.get(),
    'result must be a string': function(topic) {
      assert.isString(topic);
    },
    'result must be a non-null alphanumeric string': function(topic) {
      assert.isNotZero(topic.length);
    }
  },

  'Verify the token': {
    topic: token.verify(token.get()),
    'should be correct for this server': function(topic) {
      assert.isTrue(topic);
    }
  },

  /**
   * Ask for NUM_TOKENS tokens. Should be all different
   */
  'Getting a lot of tokens': {
    topic: getTokens(),
    'all items MUST BE different': function(topic) {
      assert.isTrue(allDifferents(topic));
    }
  }
}).export(module);