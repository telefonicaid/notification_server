/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

/**
 * E2E test for Push Notifications.
 * This is not a unit test. Just first run the server with the default
 * configurations (in config.js.template in the src/ dir)
 *
 * $ node start.js
 *
 * and then run this test with:
 *
 * $ node E2Etest.js
 *
 * It expects to run in localhost.
 *
 * If there is no output (except maybe a couple of fails of the websockets
 * module when not using native fast extensions),
 * it means that everything went well. If not, there
 * will be debug information showing what failed.
 */

function sendRegisterUAMessage() {
  var connection = PushTest.connection;
  if (connection.connected) {
    PushTest.registerUAOK = false;
    var msg = ('{"data": {"uatoken":"' + PushTest.token + '"}, "messageType":"registerUA"}');
    connection.sendUTF(msg.toString());
  }
}

 var PushTest = {

  getToken: function getToken() {
    PushTest.NOTIFICATION = '{"messageType":"notification","id":1234,"message":"Hola","signature":"","ttl":0,"timestamp":"SINCE_EPOCH_TIME","priority":1}';
    var port = require('../src/config.js').NS_UA_WS.interfaces[0].port;

    var http = require("http");

    var options = {
      host: 'localhost',
      port: port,
      path: '/token',
      method: 'GET'
    };

    var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        debug(chunk);
        PushTest.token = chunk.toString();
      });
    });
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });
    // write data to request body
    req.end();
  },

  registerUA: function registerUA() {
    var port = require('../src/config.js').NS_UA_WS.interfaces[0].port;
    var WebSocketClient = require('websocket').client;
    var client = new WebSocketClient();

    client.on('connectFailed', function(error) {
      console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function(connection) {
      PushTest.connection = connection;
      debug('WebSocket client connected');
      connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
      });
      connection.on('close', function() {
        debug('push-notification Connection Closed');
      });
      connection.on('message', function(message) {
        if (message.type === 'utf8') {
          debug("Received: '" + message.utf8Data + "'");
          var msg = JSON.parse(message.utf8Data);
          debug(msg);
          var notificationJSON = JSON.parse(PushTest.NOTIFICATION);
          if (msg.error) {
            console.log('There was an error');
          } else if (msg.status == 'REGISTERED' && msg.messageType == "registerUA") {
            PushTest.registerUAOK = true;
            debug("UA registered");
          } else if (msg.status == 'REGISTERED' && msg.messageType == 'registerWA') {
            PushTest.registerWAOK = true;
            PushTest.url = msg.url;
            debug("WA registered with url -- " + msg.url);
          } else if (msg[0].messageType == 'notification') {
            var ack = '{"messageType": "ack", "messageId": "' + msg[0].messageId + '"}';
            PushTest.connection.sendUTF(ack);
            PushTest.gotNotification = true;
            debug("Notification received!!");
          }
        }
      });

      sendRegisterUAMessage(connection);
    });
    client.connect('ws://localhost:' + port, 'push-notification');
  },

  registerWA: function registerWA() {
    var msg = '{"data": {"uatoken":"' + PushTest.token + '", "watoken": "testApp"}, "messageType":"registerWA" }';
    PushTest.connection.sendUTF(msg.toString());
  },

  _parseURL: function _parseURL() {
    var url = require('url');
    return url.parse(PushTest.url);
  },

  sendNotification: function sendNotification() {
    var http = require("http");
    var urlData = PushTest._parseURL();
    var options = {
      host: urlData.hostname,
      port: urlData.port,
      path: urlData.pathname,
      method: 'POST'
    };

    var req = http.request(options, function(res) {
      /*console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
      });*/
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    // write data to request body
    req.write(PushTest.NOTIFICATION);
    req.end();
  },

  init: function init() {
    setTimeout(this.getToken, 0);
    setTimeout(this.registerUA, 1000);
    /*setTimeout(sendRegisterUAMessage, 1300);
    setTimeout(sendRegisterUAMessage, 1400);*/
    setTimeout(this.registerWA, 3000);
    setTimeout(this.sendNotification, 4000);
  },

  check: function check() {
    if (PushTest.registerUAOK &&
        PushTest.registerWAOK &&
        PushTest.gotNotification) {
      debug("Everything went better than expected! http://i2.kym-cdn.com/entries/icons/original/000/001/253/everything_went_better_than_expected.jpg");
    } else {
      console.log("KO, check flags:");
      console.log("registerUAOK is " + PushTest.registerUAOK);
      console.log("registerWAOK is " + PushTest.registerWAOK);
      console.log("gotNotification is " + PushTest.gotNotification);
    }
    PushTest.connection.close();
  }
};

var DEBUG = true;
debug = function(text) {
  if (DEBUG) {
    console.log(text);
  }
};

PushTest.init();
setTimeout(PushTest.check, 6000);
