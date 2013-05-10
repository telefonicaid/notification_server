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
    errorcodes = require('../../common/constants').errorcodes.GENERAL,
    maintenance = require('../../common/maintenance.js');

var infoAPI = function() {
  this.processRequest = function(request, body, response, path) {
    log.debug("NS_AS::onHTTPMessage - infoAPI");
    switch (path[1]) {
    case 'about':
      if (consts.PREPRODUCTION_MODE) {
        try {
          var p = new pages();
          p.setTemplate('views/about.tmpl');
          text = p.render(function(t) {
            switch (t) {
              case '{{GIT_VERSION}}':
                return require('fs').readFileSync('version.info');
              case '{{MODULE_NAME}}':
                return 'Application Server Frontend';
              default:
                return '';
            }
          });
        } catch(e) {
          text = "No version.info file";
        }
        response.setHeader('Content-Type', 'text/html');
        response.statusCode = 200;
        response.write(text);
        response.end();
      } else {
        response.res(errorcodes.NOT_ALLOWED_ON_PRODUCTION_SYSTEM);
      }
      return true;

    case 'status':
      // Return status mode to be used by load-balancers
      response.setHeader('Content-Type', 'text/html');
      if (maintenance.getStatus()) {
        response.statusCode = 503;
        response.write('Under Maintenance');
      } else {
        response.statusCode = 200;
        response.write('OK');
      }
      response.end();
      return true;
    }

    return false;
  };
};

module.exports = new infoAPI();