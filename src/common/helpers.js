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
function getConnectionId(connection) {
	return connection.socket.remoteAddress + ":" + connection.socket.remotePort;
}
exports.getConnectionId = getConnectionId;
