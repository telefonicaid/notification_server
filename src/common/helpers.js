var publicBaseURL = require('../config.js').NS_AS.publicBaseURL;

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
var connection_last_id = 0;
function getConnectionId(connection) {
  if( typeof connection.__uniqueid == "undefined" ) {
    connection.__uniqueid = ++connection_last_id;
  }

  return connection.__uniqueid;
}
exports.getConnectionId = getConnectionId;
