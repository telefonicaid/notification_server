var publicBaseURL = require('../config.js').NS_AS.publicBaseURL;

function getNotificationURL(watoken) {
	return publicBaseURL + "/notify/" + watoken;
}

exports.getNotificationURL = getNotificationURL;