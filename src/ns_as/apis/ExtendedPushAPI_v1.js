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
        response.res(errorcodesAS.BAD_URL_NOT_VALID_METHOD);
        return true;
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