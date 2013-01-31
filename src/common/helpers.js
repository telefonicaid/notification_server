/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var publicBaseURL = require('../config.js').consts.publicBaseURL,
    uuid = require('node-uuid'),
    crypto = require('../common/cryptography.js'),
    exec = require('child_process').exec;

/**
 * Gets the public notification URL for the given apptoken
 */
function getNotificationURL(apptoken) {
  return publicBaseURL + '/notify/' + apptoken;
}
exports.getNotificationURL = getNotificationURL;

function getAppToken(watoken, pbkbase64) {
  return crypto.hashSHA256(watoken + pbkbase64);
}
exports.getAppToken = getAppToken;

function padNumber(number,len) {
  var str = '' + number;
  while (str.length < len) {
      str = '0' + str;
  }
  return str;
}
exports.padNumber = padNumber;

function checkCallback(callback) {
  if (typeof callback !== 'function') {
    callback = function() {};
  }
  return callback;
}
exports.checkCallback = checkCallback;

function getMaxFileDescriptors(cb) {
  exec('ulimit -n', function(error,stdout,stderr) {
    cb(error, stdout);
  });
}
exports.getMaxFileDescriptors = getMaxFileDescriptors;
