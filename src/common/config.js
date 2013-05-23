/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var _config = require('./config_default.js'),
    fs = require('fs');

(function loadConfig() {
  if(fs.existsSync('./config.js')) {
    require('../config.js').config(_config);
  };
  module.exports = _config;
})();
