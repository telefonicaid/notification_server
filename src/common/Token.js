/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var uuid = require('node-uuid'),
  Cryptography = require('./Cryptography.js'),
    cryptokey = require('../config.js').consts.cryptokey;

function Token() {}

Token.prototype = {

  // The TOKEN shall be unique
  get: function() {
    // Just get a raw uuid as raw token and let's hope unique means unique
    var rawToken = uuid.v4();
    return rawToken + '@' + Cryptography.generateHMAC(rawToken, cryptokey);
  },

  // Verify the given TOKEN
  verify: function(token) {
    if (!token) {
      return false;

    }

    // Split token and HMAC
    var tokenAndHMAC = token.split('@');

    // Verification
    return (tokenAndHMAC[1] &&
            (tokenAndHMAC[1] === Cryptography.generateHMAC(tokenAndHMAC[0], cryptokey)));
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var token = new Token();
function getToken() {
  return token;
}

module.exports = getToken();
