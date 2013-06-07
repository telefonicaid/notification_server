/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

// Crypto module. See: http://nodejs.org/docs/latest/api/crypto.html
var crypto = require('crypto');

function cryptography() {}

cryptography.prototype = {

  ////////////////////////////////////////////
  // HASH functions
  ////////////////////////////////////////////
  hashSHA256: function(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  hashSHA512: function(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
  },

  // Lets go with SHA-1 for now, can change it later on
  generateHMAC: function(data,key) {
     return crypto.createHmac('sha1', key).update(data).digest('hex');
  }

};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var crypt = new cryptography();
function getCrypto() {
  return crypt;
}

module.exports = getCrypto();
