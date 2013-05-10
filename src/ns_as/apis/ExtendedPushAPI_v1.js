/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var pages = require('../../common/pages.js'),
    log = require('../../common/logger'),
    consts = require('../../config.js').consts,
    errorcodes = require('../../common/constants').errorcodes.GENERAL;

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////
function onNewPushMessage(notification, certificate, apptoken, callback) {
  var json = null;

  //Only accept valid JSON messages
  try {
    json = JSON.parse(notification);
  } catch (err) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Not valid JSON notification');
    return callback(errorcodesAS.JSON_NOTVALID_ERROR);
  }

  //Get all attributes and save it to a new normalized notification
  //Also, set not initialized variables.
  var normalizedNotification = {};

  //These are mandatory
  normalizedNotification.messageType = json.messageType;
  normalizedNotification.id = json.id;

  //This are optional, but we set to default parameters
  normalizedNotification.message = json.message || '';
  normalizedNotification.ttl = json.ttl || consts.MAX_TTL;
  normalizedNotification.timestamp = json.timestamp || (new Date()).getTime();
  normalizedNotification.priority = json.priority ||  '4';

  //Reject if no valid certificate is received
  if (!certificate.fingerprint) {
    return callback(errorcodesAS.BAD_MESSAGE_BAD_CERTIFICATE);
  }

  //Only accept notification messages
  if (normalizedNotification.messageType != 'notification') {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Not valid messageType');
    return callback(errorcodesAS.BAD_MESSAGE_TYPE_NOT_NOTIFICATION);
  }

  //If bad id (null, undefided or empty), reject
  if ((normalizedNotification.id == null) || (normalizedNotification.id == '')) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Bad id');
    return callback(errorcodesAS.BAD_MESSAGE_BAD_ID);
  }

  //Reject notifications with big attributes
  if ((normalizedNotification.message.length > config.NS_AS.MAX_PAYLOAD_SIZE) ||
      (normalizedNotification.id.length > consts.MAX_ID_SIZE)) {
    log.debug('NS_AS::onNewPushMessage --> Rejected. Notification with a big body (' + normalizedNotification.message.length + '>' + config.NS_AS.MAX_PAYLOAD_SIZE + 'bytes), rejecting');
    return callback(errorcodesAS.BAD_MESSAGE_BODY_TOO_BIG);
  }

  //Get the Certificate for the apptoken in the database
  dataStore.getCertificateApplication(apptoken, function(error, cert) {
    if (error) {
      return callback(errorcodesAS.BAD_MESSAGE_BAD_CERTIFICATE);
    }
    if (!cert) {
      log.debug('NS_AS::onNewPushMessage --> Rejected. AppToken not found, dropping notification');
      return callback(errorcodesAS.BAD_URL_NOT_VALID_APPTOKEN);
    }

    if (crypto.hashSHA256(certificate.fingerprint) != cert.fs) {
      log.debug('NS_AS::onNewPushMessage --> Rejected. Bad certificate, dropping notification');
      return callback(errorcodesAS.BAD_MESSAGE_BAD_CERTIFICATE);
    }

    var id = uuid.v1();
    log.debug("NS_AS::onNewPushMessage --> Storing message for the '" + apptoken + "' apptoken with internal Id = '" + id + "'. Message:", normalizedNotification);
    log.notify(log.messages.NOTIFY_MSGSTORINGDB, {
      "apptoken": apptoken,
      "id": id
    });
    // Store on persistent database
    var msg = dataStore.newMessage(id, apptoken, normalizedNotification);
    // Also send to the newMessages Queue
    msgBroker.push('newMessages', msg);
    return callback(errorcodes.NO_ERROR);
  });
}
////////////////////////////////////////////////////////////////////////////////

var ExtendedPushAPI_v1 = function() {
  this.processRequest = function(request, body, response, path) {
    log.debug("NS_AS::onHTTPMessage - ExtendedPushAPI_v1");
    if (path[1] === 'notify') {
      var token = path[2];
      if (!token) {
        log.debug('NS_AS::onHTTPMessage.ExtendedPushAPI_v1 --> No valid url (no apptoken)');
        response.res(errorcodesAS.BAD_URL_NOT_VALID_APPTOKEN);
        return true;
      }
      if (request.method != 'POST') {
        log.debug('NS_AS::onHTTPMessage.ExtendedPushAPI_v1 --> No valid method (only POST for notifications)');
        return false;
      }

      log.debug('NS_AS::onHTTPMessage.ExtendedPushAPI_v1 --> Notification for ' + token);
      request.on('data', function(notification) {
        onNewPushMessage(notification, request.connection.getPeerCertificate(), token, function(err) {
          response.res(err);
        });
      });
      return true;
    }
    return false;
  };
};

module.exports = new ExtendedPushAPI_v1();