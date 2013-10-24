/**
 * E2E test for Push Notifications.
 * This is not a unit test. Just first run the server with the default
 * configurations (in config.js.template in the src/ dir)
 *
 * $ node start.js
 *
 * and then run this test with:
 *
 * $ node E2E.js 'wss://ua.push.tefdigital.com:443/'
 *
 * It expects to run in localhost.
 *
 * If there is no output (except maybe a couple of fails of the websockets
 * module when not using native fast extensions),
 * it means that everything went well. If not, there
 * will be debug information showing what failed.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

(function checkArgvLength() {
  if (process.argv.length < 3) {
    console.log('You need to supply the WebSocket to connect to');
    console.log('node E2E.js \'wss://ua.push.tefdigital.com:443/\'');
    process.exit(1);
  }
})();

var debug = require('./common').debug,
    fs = require('fs');

 var PushTest = {
  registerUA: function registerUA() {
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
          if (!Array.isArray(msg)) msg = [msg];
          if (msg[0].status == 200 && msg[0].messageType == "hello") {
            PushTest.registerUAOK = true;
            debug("UA registered");
          } else if (msg[0].status == 200 && msg[0].messageType == 'register') {
            PushTest.registerWAOK = true;
            PushTest.url = msg[0].pushEndpoint;
            debug("WA registered with url -- " + msg[0].pushEndpoint);
          } else if (msg[0].messageType == 'notification') {
            PushTest.gotNotification = true;
            PushTest.connection.sendUTF('{"messageType": "ack", "updates":' + JSON.stringify(msg[0].updates) + '}');
            debug("Notification received!! Sending ACK");
          }
        }
      });

      function sendRegisterUAMessage() {
        if (connection.connected) {
          var msg = ('{"uaid": null, "messageType":"hello"}');
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
    debug('E2E::_pushURL --> ' + PushTest.url);
    if (!PushTest.url) return;
    return url.parse(PushTest.url);
  },

  sendNotification: function sendNotification() {
    var https = require("https");
    var urlData = PushTest._parseURL();
    if (!urlData) return;
    var options = {
      host: urlData.hostname,
      port: urlData.port,
      path: urlData.pathname,
      method: 'PUT',
      rejectUnauthorized: false,
      requestCert: true,
      agent: false
    };
    options.agent = new https.Agent(options);

    var req = https.request(options, function(res) {
      res.on('data', function(chunk) {
        debug('E2E::sendNotification::request --> ' + chunk);
        debug('E2E::sendNotification::request --> ' + res.statusCode);
      });
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    // write data to request body
    req.write(PushTest.NOTIFICATION);
    req.end();
  },

  init: function init() {
    PushTest.port =  require('../../src/config.js').NS_UA_WS.interfaces[0].port;
    PushTest.host = '127.0.0.1';
    PushTest.NOTIFICATION = 'version=1';

    setTimeout(this.registerUA, 2000);
    setTimeout(this.registerWA, 4000);
    setTimeout(this.sendNotification, 6000);
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


PushTest.init();
setTimeout(PushTest.check, 10000);
