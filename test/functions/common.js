/**
 * Common functions to functional tests
 */

exports.serverData = {
  port: require('../../src/config.js').NS_UA_WS.interfaces[0].port,
  host: '127.0.0.1'
};

/**
 * This is the signature for the "Hola" message and the PbK-public key in
 * the test/scripts/ folder.
 */
var date = new Date().getTime();
exports.testNotificationText = '{"messageType":"notification",' +
                                 '"id":1234,' +
                                 '"message":"Hola",' +
                                 '"signature":"691cb72015afdba8742349431500b497fe689523c7bd8b9ab9d905160efed20e8c70e7ba1aec112c494721f253b8874f90d611b8ebd78e5017aaf971f0f01503e2d3ba1949cd11c145f0537b7c80a7933368f405d12b723f8107c92af1e1d58a93c48a9af3f55ee519719b8ba1632e1fd12f9d3eb99846abb849793516bf1fa0",' +
                                 '"ttl":0,' +
                                 '"timestamp":"' + date + '",' +
                                 '"priority":1' +
                               '}';

exports.getToken = function getToken(callback) {
  var https = require("https");

  var options = {
    host: exports.serverData.host,
    port: exports.serverData.port,
    path: '/token',
    method: 'GET'
  };

  var req = https.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
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

exports.sendNotification = function sendNotification(url, text, callback) {
  var https = require("https");
  var urllib = require('url');
  var urlData = urllib.parse(url);
  var options = {
    host: urlData.hostname,
    port: urlData.port,
    path: urlData.pathname,
    method: 'POST'
  };

  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      callback(null, res.statusCode, chunk, text);
    });
  });

  req.on('error', function(e) {
    debug('problem with request: ' + e.message);
    callback(e.message, null, null, text);
  });

  // write data to request body
  req.write(text);
  req.end();
};

exports.allDifferents = function allDifferents(l) {
  var obj = {};
  for (var i = 0, item; item = l[i]; i++) {
    if (obj[item]) return false;
    obj[item] = 1;
  }
  return true;
};

var DEBUG = false;
debug = function(text) {
  if (DEBUG) {
    console.log(text);
  }
};
exports.debug = debug;
