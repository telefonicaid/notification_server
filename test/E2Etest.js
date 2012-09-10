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

 var PushTest = {

  getToken: function getToken() {
    PushTest.port =  require('../src/config.js').NS_UA_WS.interfaces[0].port;
    PushTest.host = '127.0.0.1';
    PushTest.NOTIFICATION = '{"messageType":"notification","id":1234,"message":"Hola","signature":"","ttl":0,"timestamp":"SINCE_EPOCH_TIME","priority":1}';

    var http = require("http");
    var options = {
      host: PushTest.host,
      port: PushTest.port,
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
          if (msg.status == 'REGISTERED' && msg.messageType == "registerUA") {
            PushTest.registerUAOK = true;
            debug("UA registered");
          } else if (msg.status == 'REGISTERED' && msg.messageType == 'registerWA') {
            PushTest.registerWAOK = true;
            PushTest.url = msg.url;
            debug("WA registered with url -- " + msg.url);
          } else if (msg[0].messageType == 'notification') {
            PushTest.gotNotification = true;
            PushTest.connection.sendUTF('{"messageType": "ack", "messageId": "' + msg[0].messageId+ '"}');
            debug("Notification received!! Sending ACK");
          }
        }
      });

      function sendRegisterUAMessage() {
        if (connection.connected) {
          var msg = ('{"data": {"uatoken":"' + PushTest.token + '"}, "messageType":"registerUA"}');
          connection.sendUTF(msg.toString());
          PushTest.registerUAOK = false;
        }
      }
      sendRegisterUAMessage();
    });
    client.connect('ws://' + PushTest.host + ':' + PushTest.port, 'push-notification');
  },

  registerWA: function registerWA() {
    var msg = '{"data": {"watoken": "testApp"}, "messageType":"registerWA" }';
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

    var req = http.request(options, function(res) {});

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
    setTimeout(this.registerWA, 2000);
    setTimeout(this.sendNotification, 3000);
  },

  check: function check() {
    if (PushTest.registerUAOK &&
        PushTest.registerWAOK &&
        PushTest.gotNotification) {
      debug("Everything went better than expected! http://i2.kym-cdn.com/entries/icons/original/000/001/253/everything_went_better_than_expected.jpg");
      PushTest.connection.close();
      process.exit(0);
    } else {
      console.log("KO, check flags:");
      console.log("registerUAOK is " + PushTest.registerUAOK);
      console.log("registerWAOK is " + PushTest.registerWAOK);
      console.log("gotNotification is " + PushTest.gotNotification);
      PushTest.connection.close();
      process.exit(1);
    }
  }
};

var DEBUG = false;
debug = function(text) {
  if (DEBUG) {
    console.log(text);
  }
};

PushTest.init();
setTimeout(PushTest.check, 5000);
