/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var publicBaseURL = require('../config.js').consts.publicBaseURL;
var uuid = require("node-uuid");
var crypto = require("../common/cryptography.js");

/**
 * Gets the public notification URL for the given apptoken
 */
function getNotificationURL(apptoken) {
	return publicBaseURL + "/notify/" + apptoken;
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
