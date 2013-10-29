/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var fs = require('fs');
var S = require('string');
function Pages() {}

Pages.prototype = {
  setTemplate: function(tmpl) {
    try {
      this.template = fs.readFileSync(tmpl).toString();
    } catch(e) {
      this.template = '<html><head><title>Error</title></head><body><h1>Error</h1></body></html>';
    }
  },

  render: function(cb) {
    var regex = /({{\S+}})/;
    var match;
    while (match = regex.exec(this.template)) {
      this.template = S(this.template).replaceAll(match[1], cb(match[1])).s;
    }
    return this.template;
  }
};

module.exports = Pages;
