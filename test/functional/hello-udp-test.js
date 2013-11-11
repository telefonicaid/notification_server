'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var exec = require('child_process').exec,
    assert = require('assert'),
    path = require('path'),
    debug = require('./common').debug,
    vows = require('vows'),
    common = require('../functional/common');

/**
 * First, we need to add a wakeup server to the carrier we are going to test
 * which is 214-07. We are going to use the script on $root/scripts/add_wakeup_server_ip.sh.
 *
 */

exec(path.resolve('./scripts/add_wakeupserver_ip.sh 214 007 http:/\/localhost:8090/'),
  function(error, stdout, stderr) {
    if (error) {
      console.log('Wakeup Server insertion ERRORED' + error);
      process.exit(1);
    } else {
      debug('Wakeup Server correctly added');
    }
  }
);

var PushTest = {
  init: function init(cb) {
    var WebSocketClient = require('websocket').client;
    var client = new WebSocketClient();

    client.on('connectFailed', function(error) {
      console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function(connection) {
      PushTest.connection = connection;
      debug('WebSocket client connected');
      connection.on('error', function(error) {
        console.log('Connection Error: ' + error.toString());
        cb(error.toString());
        cb = function() {};
      });
      connection.on('close', function() {
        debug('push-notification Connection Closed');
      });
      connection.on('message', function(message) {
        if (message.type === 'utf8') {
          debug('Received: "' + message.utf8Data + '"');
          var msg = JSON.parse(message.utf8Data);
          debug(msg);
          if (!Array.isArray(msg)) {
            msg = [msg];
          }
          if (msg[0].messageType === 'hello') {
            debug('UA registered with UDP');
            cb(null, msg[0].status);
            cb = function() {};
            return;
          } else {
            cb('Message received is not hello, is ' + msg[0].messageType);
            cb = function() {};
          }
        } else {
          cb('Not UTF8 message');
          cb = function() {};
        }
      });

      (function sendRegisterUAMessage() {
        if (connection.connected) {
          var msg = '{"uaid":null,"channelIDs":[],"wakeup_hostport":{"ip":"192.168.1.1","port":8080},"mobilenetwork":{"mcc":"214","mnc":"07"},"protocol":"udp","messageType":"hello"}';
          connection.sendUTF(msg.toString());
          PushTest.registerUAOK = false;
        } else {
          console.log('sendRegisterUAMessage() --> The WS is down. Check first steps');
        }
      })();
    });
    client.connect('wss://localhost:8080/', 'push-notification');
  }
};

vows.describe('UDP hello test').addBatch({
  'Is called with': {
    topic: function() {
      PushTest.init(this.callback);
      setTimeout(this.callback, 20000);
    },
    ' a 201 statusCode and no error': function(error, statusCode) {
      assert.isNull(error);
      assert.equal(statusCode, 201);
    }
  }
}).export(module);


