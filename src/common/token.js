/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var uuid = require("node-uuid"),
    crypto = require("./cryptography.js"),
    server_info = require("../config.js").NS_AS.server_info;

function token() {}

token.prototype = {
  serialNumber: 1,

  // The TOKEN shall be unique
  get: function() {
    // SerialNumber + TimeStamp + NotificationServer_Id + CRC -> RAWToken
    var rawToken = this.serialNumber++ + "#" + Date.now() + "#" + process.serverId + "_" + uuid.v1();

    //////////////////////////////////////////////////////////////////////////////////////
    // Due to the Node.JS Crypto library decission (ignore padding) we should add it:
    // @see https://github.com/joyent/node/blob/master/src/node_crypto.cc#1923
    /*
     * // local decrypt final without strict padding check
     * // to work with php mcrypt
     * // see http://www.mail-archive.com/openssl-dev@openssl.org/msg19927.html
     * int local_EVP_DecryptFinal_ex(EVP_CIPHER_CTX *ctx,
     *                         unsigned char *out,
     *                         int *outl) {
     */
    while( (rawToken.length - 32) % 16 > 0 ) rawToken+="#";    // 32 == MD5 length
    //////////////////////////////////////////////////////////////////////////////////////

    // CRC
    rawToken += "@" + crypto.hashMD5(rawToken);

    // Encrypt token with AES
    return crypto.encryptAES(rawToken, server_info.key);
  },

  // Verify the given TOKEN
  verify: function(token) {
    if(!token)
      return false;

    // Decrypt token
    var rawToken = crypto.decryptAES(token, server_info.key).split('@');

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
