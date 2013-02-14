/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var assert = require('assert'),
    vows = require('vows'),
    token = require('../../src/common/token');
    common = require('../functional/common');

//Internal vars
var NUM_TOKENS = 50000;
var tokens = [];
//Get a lot of tokens
(function getTokens() {
  for (var i = NUM_TOKENS; i > 0; i--) {
    tokens.push(token.get());
  }
  return tokens;
})();

function verifyTokens() {
  tokens.forEach(function(element) {
    token.verify(element);
  });
}

function setCharAt(str,index,chr) {
  if(index > str.length-1) return str;
  return str.substr(0,index) + chr + str.substr(index+1);
}

var tokensModified = [];
//Get tokens, and modify it
(function getTokensAndMofify() {
  var tokenito = '';
  var length = 0;
  var tokenitoAfter = '';
  for (var i = tokenito.length; i > 0; i--) {
    tokenito = token.get();
    length = tokenito.length-1;
    tokenitoAfter = tokenito;
    tokenitoAfter = setCharAt(tokenito,
                              tokenito.length-i,
                              String.fromCharCode(tokenito.charCodeAt(length-1) +
                                                  Math.floor(Math.random()*11)));
    tokensModified.push(tokenitoAfter);
  }
  return tokensModified;
})();



// TESTS //
vows.describe('Token tests').addBatch({
  /**
   * Ask for NUM_TOKENS tokens. Should be all different
   */
  'Getting a lot of tokens': {
    topic: tokens,
    'we should have NUM_TOKENS elements': function(topic) {
      assert.equal(topic.length, NUM_TOKENS);
    },
    'all items should not be nulls': function(topic) {
      topic.forEach(function(elem) {
        assert.isNotNull(elem);
      });
    },
    'all items should be strings': function(topic) {
      topic.forEach(function(elem) {
        assert.isString(elem);
      });
    },
    'all items should have length>0': function(topic) {
      topic.forEach(function(elem) {
        assert.isNotZero(elem.length);
      });
    },
    'all items should be valid': function(topic) {
      topic.forEach(function(elem) {
        assert.isTrue(token.verify(elem));
      });
    },
    'all items MUST BE different': function(topic) {
      assert.isTrue(common.allDifferents(topic));
    }
  },
  'Modified tokens are not correct': {
    topic: tokensModified,
    'all items must be invalid': function(topic) {
      topic.forEach(function(elem) {
        assert.isFalse(token.verify(elem));
      });
    }
  }
}).export(module);
