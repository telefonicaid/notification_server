/* jshint node: true */
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
    exec = require('child_process').exec,
    net = require('net');

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

function isVersion(n) {
    return !isNaN(parseInt(n)) && isFinite(n) &&
        (n < 9007199254740992) && (n >= 0) && (n % 1 === 0);
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
      log.error(log.messages.ERROR_NOCADEFINED, {
        "path": caDir
      });
      return cas;
    }

    for (i = 0; i < len; i++) {
      cas.push(fs.readFileSync(caDir + path.sep + files[i]));
    }
  } catch (e) {
    log.error(log.messages.ERROR_NOCADEFINED, {
        "path": caDir
    });
  }

  return cas;
}
exports.getCaChannel = getCaChannel;

function isIPInNetwork(ip, networks) {
  var range_check = require('range_check');

  if (!net.isIP(ip)) {
    return false;
  }

  if (!Array.isArray(networks)) {
    networks = [];
  }

  //Adding private networks from https://tools.ietf.org/html/rfc1918
  //If networks are empty, we add RFC private networks.
  if (networks.length === 0) {
    networks.push("10.0.0.0/8");
    networks.push("172.16.0.0/12");
    networks.push("192.168.0.0/16");
  }
  //If IP is in one of the network ranges, we think that you are in a
  //private network and can be woken up.
  return range_check.in_range(ip, networks);
};
exports.isIPInNetwork = isIPInNetwork;