/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

// Crypto module. See: http://nodejs.org/docs/v0.3.1/api/crypto.html
var crypto = require('crypto');

function cryptography() {}

cryptography.prototype = {

  ////////////////////////////////////////////
  // Signature validations
  ////////////////////////////////////////////

  /**
   * Verify signature using RSA-SHA256
   *
   * Use Public/Private keys for signatures:
   * Private Key generation:
   *  openssl genrsa 1024 > private.key
   * Public Key generation:
   *  openssl rsa -in private.key -out public.pem -outform PEM -pubout
   * Signing data using private key:
   *  openssl dgst -hex -sha256 -sign private.key msg.txt
   *
   * See:
   *  http://www.openssl.org/docs/HOWTO/keys.txt
   *  http://www.codealias.info/technotes/openssl_rsa_sign_and_verify_howto
   */
  verifySignature: function(data,signature,publicKey) {
    var algorithm = 'RSA-SHA256';
    var verifier = crypto.createVerify(algorithm);
    verifier.update(data);
    return verifier.verify(publicKey, signature, 'hex');
  },

  ////////////////////////////////////////////
  // HASH functions
  ////////////////////////////////////////////
  hashMD5: function(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  },

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
