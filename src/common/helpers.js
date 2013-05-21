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

/**
 * Check if a version is a valid one for this API (v1)
 * In v1 case:
 *   - should be a number
 *   - should not be NaN
 *   - should be greater or equal than 0
 */
function isVersion(version) {
  var number = parseInt(version, 10);
  if (typeof number !== 'number') {
    return false;
  }

  if (isNaN(number)) {
    return false;
  }

  if (number < 0) {
    return false;
  }

  return true;
}
exports.isVersion = isVersion;

function getCaChannel() {

  var log = require('./logger.js');
  var caDir = require('../config.js').consts.caDir;

  var cas = [];
  if (!caDir) {
    log.error(log.messages.ERROR_CASDIRECTORYUNDEFINED);
    return cas;
  }

  var path = require('path');
  var fs = require('fs');
  try {
    var files = fs.readdirSync(caDir);

    var i;
    var len = files.length;
    if (len === 0) {
      log.error(log.messages.ERROR_NOCADEFINED);
      return cas;
    }

    for (i = 0; i < len; i++) {
      cas.push(fs.readFileSync(caDir + path.sep + files[i]));
    }
  } catch (e) {
    log.error(log.messages.ERROR_NOCADEFINED, {
          "method": 'getCaChannel',
          "error": e
    });
  }

  return cas;
}
exports.getCaChannel = getCaChannel;
