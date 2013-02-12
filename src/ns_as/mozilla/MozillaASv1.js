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
    uuid = require('node-uuid');

var kMozASFrontendVersion = 'v1';

var MozASFrontendv1 = function() {
  this.processRequest = function(request, body, response) {
    var URI = request.url.split('/');
    if (URI.length < 3) {
      response.statusCode = 404;
      response.end('{ reason: "Not enough path data"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> Not enough path');
      return;
    }

    if (URI[1] !== kMozASFrontendVersion) {
      response.statusCode = 400;
      response.end('{ reason: "Protocol version not supported"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> Version not supported, received: ' + URI[1]);
      return;
    }

    if (URI[2] !== 'notify') {
      response.statusCode = 404;
      response.end('{ reason: "API not known"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> API call not known, received: ' + URI[2]);
      return;
    }

    var channelID = URI[3];
    if (!channelID) {
      response.statusCode = 404;
      response.end('{ reason: "Not enough path data"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> Not enough path');
      return;
    }

    var versions = String(body).split('=');
    if (versions[0] !== 'version') {
      response.statusCode = 404;
      response.end('{ reason: "Bad body"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> Bad body, received lhs: ' + versions[0]);
      return;
    }

    //Check version TODO, possible function?
    if (!versions[1]) {
      response.statusCode = 404;
      response.end('{ reason: "Bad version"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> Bad body, received lhs: ' + versions[0]);
      return;
    }

    //Now, we are safe to start using the path and data
    var id = uuid.v4();
    log.notify('id=' + id + " -- channelID=" + channelID + " -- version=" + versions[1]);
    var msg = dataStore.newVersion(id, channelID, versions[1]);
    msgBroker.push('newMessages', msg);
    response.statusCode = 200;
    response.end('{}');
    return;
  };
};

module.exports = MozASFrontendv1;