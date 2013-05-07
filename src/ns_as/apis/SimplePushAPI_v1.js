/* jshint node: true */

/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dataStore = require('../../common/datastore'),
    msgBroker = require('../../common/msgbroker'),
    log = require('../../common/logger'),
    errorcodes = require('../../common/constants').errorcodes.GENERAL,
    errorcodesAS = require('../../common/constants').errorcodes.AS,
    uuid = require('node-uuid'),
    isVersion = require('../../common/helpers').isVersion;

var kSimplePushASFrontendVersion = 'v1';

var SimplePushAPI_v1 = function() {
  this.processRequest = function(request, body, response, path) {
    log.debug("NS_AS::onHTTPMessage - SimplePushAPI_v1");
    if (request.method !== 'PUT') {
      return false;
    }

    log.debug('NS_AS::onHTTPMessage.SimplePushAPI_v1 --> Received a PUT');
    request.on('data', function(body) {
      apis[0].processRequest(request, body, response);
    });

    var URI = request.url.split('/');
    if (URI.length < 3) {
      response.statusCode = 404;
      response.end('{ reason: "Not enough path data"}');
      log.debug('NS_AS::onHTTPMessage.SimplePushAPI_v1::processRequest --> Not enough path');
      return true;
    }

    if (URI[1] !== kSimplePushASFrontendVersion) {
      response.statusCode = 400;
      response.end('{ reason: "Protocol version not supported"}');
      log.debug('NS_AS::onHTTPMessage.SimplePushAPI_v1::processRequest --> Version not supported, received: ' + URI[1]);
      return true;
    }

    if (URI[2] !== 'notify') {
      response.statusCode = 404;
      response.end('{ reason: "API not known"}');
      log.debug('NS_AS::onHTTPMessage.SimplePushAPI_v1::processRequest --> API call not known, received: ' + URI[2]);
      return true;
    }

    var appToken = URI[3];
    if (!appToken) {
      response.statusCode = 404;
      response.end('{ reason: "Not enough path data"}');
      log.debug('NS_AS::onHTTPMessage.SimplePushAPI_v1::processRequest --> Not enough path');
      return true;
    }

    var versions = String(body).split('=');
    if (versions[0] !== 'version') {
      response.statusCode = 404;
      response.end('{ reason: "Bad body"}');
      log.debug('NS_AS::onHTTPMessage.SimplePushAPI_v1::processRequest --> Bad body, received lhs: ' + versions[0]);
      return true;
    }

    var version = versions[1];
    if (!isVersion(version)) {
      response.statusCode = 404;
      response.end('{ reason: "Bad version"}');
      log.debug('NS_AS::onHTTPMessage.SimplePushAPI_v1::processRequest --> Bad version, received rhs: ' + version);
      return true;
    }

    //Now, we are safe to start using the path and data
    log.notify(log.messages.NOTIFY_APPTOKEN_VERSION, {
      'appToken': appToken,
      'version': version
    });
    dataStore.getChannelIDForAppToken(appToken, function(error, channelID) {
      // If there is no channelID associated with a appToken,
      // fool the sender with a OK response, but nothing is done here.
      if (!channelID) {
        response.statusCode = 200;
        response.end('{}');
        return;
      }
      var msg = dataStore.newVersion(appToken, channelID, version);
      msgBroker.push('newMessages', msg);
      response.statusCode = 200;
      response.end('{}');
    });
    return true;
  };
};

module.exports = new SimplePushAPI_v1();
