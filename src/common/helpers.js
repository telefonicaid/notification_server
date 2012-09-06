/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var publicBaseURL = require('../config.js').NS_AS.publicBaseURL;
var uuid = require("node-uuid");

/**
 * Gets the public notification URL for the given watoken
 */
function getNotificationURL(watoken) {
	return publicBaseURL + "/notify/" + watoken;
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
