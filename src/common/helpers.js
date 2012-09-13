/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var publicBaseURL = require('../config.js').NS_AS.publicBaseURL;
var uuid = require("node-uuid");
var crypto = require("../common/cryptography.js");

/**
 * Gets the public notification URL for the given apptoken
 */
function getNotificationURL(apptoken) {
	return publicBaseURL + "/notify/" + apptoken;
}
exports.getNotificationURL = getNotificationURL;

/**
 * Gets a unique connection ID from a connection object
 */
function getConnectionId(connection) {
  if( typeof connection.__uniqueid == "undefined" ) {
    connection.__uniqueid = uuid.v1();
  }

  return connection.__uniqueid;
}
exports.getConnectionId = getConnectionId;

function getAppToken(watoken, pbkbase64) {
  return crypto.hashSHA256(watoken + pbkbase64);
}
exports.getAppToken = getAppToken;
