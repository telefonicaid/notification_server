/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var https = require('https'),
    fs = require('fs'),
    apiConfig = require('../config.js').API,
    consts = require("../config.js").consts;

function API() {
  var options = {
    key: fs.readFileSync(consts.key),
    cert: fs.readFileSync(consts.cert)
  };
  this.server = https.createServer(options, this.onHTTPMessage.bind(this));
  this.server.listen(apiConfig.port, apiConfig.ip);
  this.serverObj = {};
}

API.prototype = {
  addServers: function addServer(name, serverArr) {
    if (!Array.isArray(serverArr)) serverArr = [serverArr];
    this.serverObj[name] = serverArr;
  },

  onHTTPMessage: function onHTTPMessage(request, response) {
    if (!this.serverObj) {
      console.log('No serverObj');
      return response.end();
    }
    for (var server in this.serverObj) {
      this.serverObj[server].forEach(function(el) {
        response.write(server + ' -- ' + JSON.stringify(el.getStats()));
      });
    }
    response.end();
  }
};

var singleton = null;
if(!singleton) singleton = new API();
exports.API = singleton;