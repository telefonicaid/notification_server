/**
 * Common functions to functional tests
 */

exports.serverData = {
  port: require('../../src/common/config.js').NS_UA_WS.interfaces[0].port,
  host: '127.0.0.1'
};

var date = new Date().getTime();
//exports.testNotificationText = '{"messageType":"notification","id":1234,"message":"Hola","ttl":0,"timestamp":"' + date + '","priority":1}';
exports.testNotificationText = 'version=1';

exports.registerUA = function registerUA(connection, token, callback) {

};

exports.sendSimplePushV1Notification = function(url, versionText, callback) {
  var https = require("https");
  var urllib = require('url');
  var urlData = urllib.parse(url);
  var options = {
    host: urlData.hostname,
    port: urlData.port,
    path: urlData.pathname,
    method: 'PUT'
  };
  //options.agent = new https.Agent(options);

  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      callback(null, res.statusCode, chunk, versionText);
    });
  });

  req.on('error', function(e) {
    debug('problem with request: ' + e.message);
    callback(e.message, null, null, versionText);
  });

  // write data to request body
  req.write(versionText);
  req.end();
}

var fs = require('fs');
exports.sendNotification = function sendNotification(url, text, callback) {
  var https = require("https");
  var urllib = require('url');
  var urlData = urllib.parse(url);
  var options = {
    host: urlData.hostname,
    port: urlData.port,
    path: urlData.pathname,
    method: 'POST',
    key: fs.readFileSync('scripts/certs/client.key'),
    cert: fs.readFileSync('scripts/certs/client.crt'),
    passphrase: '1234'
  };
  options.agent = new https.Agent(options);

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
  if (!Array.isArray(l)) {
    l = [l] || [];
  }
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
