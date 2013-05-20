/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

// Crypto module. See: http://nodejs.org/docs/v0.3.1/api/crypto.html
var crypto = require('crypto'),
    exec = require('child_process').exec;

function cryptography() {}

cryptography.prototype = {

  ////////////////////////////////////////////
  // Certificate validations
  ////////////////////////////////////////////

  /**
   * Verify client certificate and return modulus
   * and fingerprint.
   *
   * Howto to generate client certificates:
   *  http://www.sslshopper.com/article-most-common-openssl-commands.html
   *  http://blog.nategood.com/client-side-certificate-authentication-in-ngi
   *
   * -> Generate your own CA
   *  openssl genrsa -des3 -out ca.key 4096
   *  openssl req -new -x509 -days 365 -key ca.key -out ca.crt
   *
   * -> Create a client private key
   *  openssl genrsa -des3 -out client.key 1024
   *
   * -> Generate the CSR (Cert. Sign Request)
   *  openssl req -new -key client.key -out client.csr
   *
   * -> Generate the client certificate signing with the CA
   *  openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt
   *
   * Afterthat, use the certificate (client.crt) to identify the webapp
   * and use the private key & certificate at server side to connect with AS
   */
  parseClientCertificate: function(cert, cb) {
    var baseCmd = 'openssl x509 -noout';
    var certificate = {
      c: cert.toString('utf8').trim()
    };
    var self = this;
    var cmdSubject = exec(baseCmd+' -subject', function(err,stdout,stderr) {
      if (err) {
        cb('[parseClientCertificate] Error, invalid certificate: ' + stderr,
          null);
        return;
      }
      certificate.s = stdout.substring(stdout.search('=')+1,stdout.length-1);

      // Fingerprint
      var cmdFP = exec(baseCmd+' -fingerprint', function(err,stdout,stderr) {
        certificate.f = stdout.substring(stdout.search('=')+1,stdout.length-1);
        certificate.fs = this.hashSHA256(certificate.f);
        cb(null, certificate);
      }.bind(self));
      cmdFP.stdin.write(cert);
      cmdFP.stdin.end();
    });
    cmdSubject.stdin.write(cert);
    cmdSubject.stdin.end();
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
