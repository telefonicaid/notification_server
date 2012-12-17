/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var uuid = require('node-uuid'),
    crypto = require('./cryptography.js'),
    cryptokey = require('../config.js').consts.cryptokey;

function token() {}

token.prototype = {
  serialNumber: 1,

  // The TOKEN shall be unique
  get: function() {
    // SerialNumber + TimeStamp + NotificationServer_Id + CRC -> RAWToken
    var rawToken = this.serialNumber++ + '#' + Date.now() + '#' + process.serverId + '_' + uuid.v1();

    // CRC
    rawToken += '@' + crypto.hashMD5(rawToken);

    // Encrypt token with AES
    return crypto.encryptAES(rawToken, cryptokey);
  },

  // Verify the given TOKEN
  verify: function(token) {
    if (!token)
      return false;

    // Decrypt token
    var rawToken = crypto.decryptAES(token, cryptokey).split('@');

    // CRC Verification
    return (rawToken[1] == crypto.hashMD5(rawToken[0]));
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var token = new token();
function getToken() {
  return token;
}

module.exports = getToken();
