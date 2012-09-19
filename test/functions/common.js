/**
 * Common functions to functional tests
 */

exports.serverData = {
  port: require('../../src/config.js').NS_UA_WS.interfaces[0].port,
  host: '127.0.0.1'
};

exports.testNotificationText = '{"messageType":"notification","id":1234,"message":"Hola","signature":"","ttl":0,"timestamp":"SINCE_EPOCH_TIME","priority":1}';

exports.getToken = function getToken(callback) {
  var http = require("http");

  var options = {
    host: exports.serverData.host,
    port: exports.serverData.port,
    path: '/token',
    method: 'GET'
  };

  var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        debug('common::getToken --> ' + JSON.stringify(options));
        debug('common::getToken::response --> ' + chunk);
        callback(null, chunk);
      });
  });
  req.on('error', function(e) {
    debug('problem with request: ' + e.message);
  });
  // write data to request body
  req.end();
};

exports.registerUA = function registerUA(connection, token, callback) {

};

exports.allDifferents = function allDifferents(l) {
  var obj = {};
  for (var i = 0, item; item = l[i]; i++) {
    if (obj[item]) return false;
    obj[item] = 1;
  }
  return true;
};

var DEBUG = true;
debug = function(text) {
  if (DEBUG) {
    console.log(text);
  }
};
exports.debug = debug;
