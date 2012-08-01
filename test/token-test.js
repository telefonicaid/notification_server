var assert = require('assert'),
    vows = require('vows'),
    token = require("../src/common/token.js").getToken();

//Internal vars
var tokens = [];
var NUM_TOKENS = 50000;
var then = new Date();

//Filling
(function fillTokens() {
  for (var i = NUM_TOKENS; i >= 0; i--) {
    tokens.push(token.get());
  }
})();

//Only for debug (time to create NUM_TOKENS tokens and add them to the array)
var now = new Date();


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

  'Verifiying the token': {
    topic: token.verify(token.get()),
    'should be correct': function(topic) {
      assert.isTrue(topic);
    }
  },

  /**
   * Ask for NUM_TOKENS tokens. Should be all different
   */
  'Getting a lot of tokens, must be ALL different': {
    topic: tokens,
    'all items are different': function(topic) {
      assert.isTrue(allDifferents(topic));
    }
  }
}).export(module);

console.log("Time spent to generate " + NUM_TOKENS + " tokens: " + (now - then) + " ms");
