/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var Pages = require("../../src/common/Pages.js"),
    assert = require('assert'),
    vows = require('vows'),
    fs = require('fs');

vows.describe('Pages tests').addBatch({
  "No template should return an error page": function() {
    var pg = new Pages();
    pg.setTemplate('/this/file/doesnot/exist.tmpl');
    var renderedPage = pg.render(function(token) {});
    assert.isString(renderedPage);
    assert.equal(renderedPage,
      '<html><head><title>Error</title></head>' +
      '<body><h1>Error</h1></body></html>');
  },
  "Changing tokens in a template": function() {
    var auxFilename = '/tmp/auxPagesTest' + Date.now() + '.tmpl';
    fs.writeFileSync(auxFilename,
      'T1={{Token1}} T2={{Token2}} T3={{Token3}} T1bis={{Token1}}');
    var pg = new Pages();
    pg.setTemplate(auxFilename);
    var renderedPage = pg.render(function(token) {
      switch (token) {
        case '{{Token1}}':
          return 1;
        case '{{Token3}}':
          return 3
        default:
          return null;
      }
    });
    assert.isString(renderedPage);
    assert.equal(renderedPage, 'T1=1 T2=null T3=3 T1bis=1');
    fs.unlinkSync(auxFilename);
  }
}).export(module);
