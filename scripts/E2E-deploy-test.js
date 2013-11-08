/**
 * E2E test for Push Notifications.
 * This is not a unit test. Just first run the server with the default
 * configurations (in config.js.template in the src/ dir)
 *
 * $ node start.js
 *
 * and then run this test with:
 * NODE1 UAID: 05c70dbf-9163-4d88-9f8d-36403137dfa9@98251e644522470948b1ae1807a29b010cf52438
 * NODE2:UAID:  adeb277b-98f2-49c6-8b24-9bf8cf4da46c@c4d5f7bd4f09569c4655e42c2ba5019063eaa4e7
 *
 *
 * $ node E2E.js 'wss://ua.push.tefdigital.com:443/'
 *
 * It expects to run in localhost.
 *
 * If there is no output (except maybe a couple of fails of the websockets
 * module when not using native fast extensions),
 * it means that everything went well. If not, there
 * will be console.log information showing what failed.
 */

(function checkArgvLength() {
  if (process.argv.length < 3) {
    console.log('You need to supply the WebSocket to connect to');
    console.log('node E2E.js \'wss://ua.push.tefdigital.com:443/\'');
    process.exit(2);
  }
})();

// Change here what you should replace
var ACTUAL = 'https://push-nv.srv.openwebdevice.com:443/';
var REPLACE = 'http://127.0.0.1:1337/';

try {
  var WebSocketClient = require('websocket').client;
  var request = require('request');
} catch(e) {
  console.log(e);
  console.log("error general")
  process.exit(2);
}

var PushTest = {
  registerUA: function registerUA() {
    var client = new WebSocketClient();

    client.on('connectFailed', function(error) {
      console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function(connection) {
      PushTest.connection = connection;
      console.log('WebSocket client connected');
      connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
      });
      connection.on('close', function() {
        console.log('push-notification Connection Closed');
      });
      connection.on('message', function(message) {
        if (message.type === 'utf8') {
          console.log("Received: '" + message.utf8Data + "'");
          var msg = JSON.parse(message.utf8Data);
          console.log(msg);
          if (!Array.isArray(msg)) msg = [msg];
          if (msg[0].status == 200 && msg[0].messageType == "hello") {
            PushTest.registerUAOK = true;
            console.log("UA registered");
          } else if (msg[0].status == 200 && msg[0].messageType == 'register') {
            PushTest.registerWAOK = true;
        console.log(REPLACE);
            PushTest.url = msg[0].pushEndpoint.replace(ACTUAL, REPLACE);
            //PushTest.url = msg[0].pushEndpoint;
            console.log("WA registered with url -- " + msg[0].pushEndpoint);
            console.log("WA registered with url -- " + PushTest.url);
          } else if (msg[0].messageType == 'notification') {
            PushTest.gotNotification = true;
            PushTest.connection.sendUTF('{"messageType": "ack", "updates":' + JSON.stringify(msg[0].updates) + '}');
            console.log("Notification received!! Sending ACK");
          }
        }
      });

      function sendRegisterUAMessage() {
        if (connection.connected) {
          //var msg = ('{"uaid": null, "messageType":"hello"}');

          var msg = ('{"uaid": "05c70dbf-9163-4d88-9f8d-36403137dfa9@98251e644522470948b1ae1807a29b010cf52438", "messageType":"hello"}');
          connection.sendUTF(msg.toString());
          PushTest.registerUAOK = false;
        } else {
          console.log('sendRegisterUAMessage() --> The WS is down. Check first steps');
        }
      }
      sendRegisterUAMessage();
    });
    client.connect(process.argv[2], 'push-notification');
  },

  registerWA: function registerWA() {
    var msg = '{"channelID": "testApp", "messageType":"register" }';
    if (!PushTest.connection || !PushTest.connection.connected) {
      console.log('registerWA() --> The WS is down. Check first steps');
      return;
    }
    PushTest.connection.sendUTF(msg.toString());
  },

  _parseURL: function _parseURL() {
    var url = require('url');
    console.log('E2E::_pushURL --> ' + PushTest.url);
    if (!PushTest.url) return;
    return url.parse(PushTest.url);
  },

  sendNotification: function sendNotification() {
    var options = {
      url: PushTest.url,
      body: PushTest.NOTIFICATION,
      method: 'PUT'
    };
    request(options, function(error, request, body) {
      if (error) {
        console.log('problem with request: ' + error);
        return;
      }
      console.log('E2E::sendNotification::request --> ' + body);
      console.log('E2E::sendNotification::request --> ' + request.statusCode);
    });
  },

  init: function init() {
    PushTest.NOTIFICATION = 'version=1';

    setTimeout(this.registerUA, 2000);
    setTimeout(this.registerWA, 4000);
    setTimeout(this.sendNotification, 6000);
  },

  check: function check() {
    if (PushTest.registerUAOK &&
        PushTest.registerWAOK &&
        PushTest.gotNotification) {
      console.log("Everything went better than expected!");
      PushTest.connection.close();
      process.exit(0);
    } else {
      console.log("KO, check flags:");
      console.log("registerUAOK is " + PushTest.registerUAOK);
      console.log("registerWAOK is " + PushTest.registerWAOK);
      console.log("gotNotification is " + PushTest.gotNotification);
      PushTest.connection.close();
      process.exit(2);
    }
  }
};


PushTest.init();
setTimeout(PushTest.check, 10000);
