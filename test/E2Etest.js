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
    this.port =  require('../src/config.js').NS_UA_WS.interfaces[0].port;
    this.host = '127.0.0.1';
    this.NOTIFICATION = '{"messageType":"notification","id":1234,"message":"Hola","signature":"","ttl":0,"timestamp":"SINCE_EPOCH_TIME","priority":1}';

    var http = require("http");
    var options = {
      host: this.host,
      port: this.port,
      path: '/token',
      method: 'GET'
    };
    var self = this;
    var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        debug(chunk);
        self.token = chunk.toString();
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

    var self = this;
    client.on('connect', function(connection) {
      self.connection = connection;
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
          var notificationJSON = JSON.parse(self.NOTIFICATION);
          if (msg && msg.status == 'REGISTERED' && msg.messageType == "registerUA") {
            self.registerUAOK = true;
            debug("UA registered");
          } else if (msg && msg.status == 'REGISTERED' && msg.messageType == 'registerWA') {
            self.registerWAOK = true;
            self.url = msg.url;
            debug("WA registered with url -- " + msg.url);
          } else if (msg && msg[0].messageType == 'notification') {
            self.gotNotification = true;
            self.connection.sendUTF('{"messageType": "ack", "messageId": "' + msg[0].messageId+ '"}');
            debug("Notification received!! Sending ACK");
          }
        }
      });

      function sendRegisterUAMessage() {
       var self = this;
        if (connection.connected) {
          var msg = ('{"data": {"uatoken":"' + self.token + '"}, "messageType":"registerUA"}');
          connection.sendUTF(msg.toString());
          self.registerUAOK = false;
        }
      }
      sendRegisterUAMessage();
    });
    client.connect('ws://' + this.host + ':' + this.port, 'push-notification');
  },

  registerWA: function registerWA() {
    var msg = '{"data": {"watoken": "testApp"}, "messageType":"registerWA" }';
    this.connection.sendUTF(msg.toString());
  },

  _parseURL: function _parseURL() {
    var url = require('url');
    return url.parse(this.url);
  },

  sendNotification: function sendNotification() {
    var http = require("http");
    var urlData = this._parseURL();
    var options = {
      host: urlData.hostname,
      port: urlData.port,
      path: urlData.pathname,
      method: 'POST'
    };

    var req = http.request(options, function(res) {
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    // write data to request body
    req.write(this.NOTIFICATION);
    req.end();
  },

  init: function init() {
    setTimeout(this.getToken, 0);
    setTimeout(this.registerUA, 1000);
    setTimeout(this.registerWA, 2000);
    setTimeout(this.sendNotification, 3000);
  },

  check: function check() {
    if (this.registerUAOK &&
        this.registerWAOK &&
        this.gotNotification) {
      debug("Everything went better than expected! http://i2.kym-cdn.com/entries/icons/original/000/001/253/everything_went_better_than_expected.jpg");
      this.connection.close();
      process.exit(0);
    } else {
      console.log("KO, check flags:");
      console.log("registerUAOK is " + this.registerUAOK);
      console.log("registerWAOK is " + this.registerWAOK);
      console.log("gotNotification is " + this.gotNotification);
      this.connection.close();
      process.exit(1);
    }
  }
};

var DEBUG = true;
debug = function(text) {
  if (DEBUG) {
    console.log(text);
  }
};

PushTest.init();
setTimeout(PushTest.check, 5000);
