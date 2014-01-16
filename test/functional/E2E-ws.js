/** jshint node:true */
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

'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

(function checkArgvLength() {
  if (process.argv.length < 3) {
    console.log('You need to supply the WebSocket to connect to');
    console.log('node E2E.js \'wss://ua.push.tefdigital.com:443/\'');
    process.exit(1);
  }
})();

var common = require('./common'),
    debug = common.debug,
    async = require('async'),
    request = require('request');
    
var WS = process.argv[2];
var OPS_TIMEOUT = (process.argv[3] * 1000) || 10000;

var registerUA = function (callback) {
  console.log('registerUA()');

  var WebSocketClient = require('websocket').client;
  var client = new WebSocketClient();
  var conn = null;

  var timeout = setTimeout(function() {
    callback('registerUA --> TIMEOUT');
    client && client.removeAllListeners && client.removeAllListeners();
    conn && conn.removeAllListeners && conn.removeAllListeners();
  }, OPS_TIMEOUT);

  client.on('connectFailed', function(error) {
    console.log('registerUA --> Connect Error: ' + error.toString());
  });

  client.on('connect', function(connection) {
    conn = connection;
    debug('WebSocket client connected');

    if (connection.connected) {
      var msg = ('{"uaid": null, "messageType":"hello"}');
      connection.sendUTF(msg.toString());
    } else {
      callback('registerUA --> Not connected');
      callback = function() {};
      client.removeAllListeners();
      connection.removeAllListeners();
      clearTimeout(timeout);
      return;
    }
    
    connection.on('error', function(error) {
      console.log('registerUA --> Connection Error: ' + error.toString());
      callback(error.toString());
      callback = function() {};
      client.removeAllListeners();
      connection.removeAllListeners();
      clearTimeout(timeout);
    });
    connection.on('close', function(error) {
      console.log('registerUA --> Connection closed: ' + error.toString());
      callback('registerUA --> ' + error.toString());
      callback = function() {};
      client.removeAllListeners();
      connection.removeAllListeners();
      clearTimeout(timeout);
    });
    connection.on('message', function(message) {
      if (message.type !== 'utf8') {
        callback('registerUA --> Message not UTF8');
        callback = function() {};
        client.removeAllListeners();
        connection.removeAllListeners();
        clearTimeout(timeout);
        return;
      }
      debug('registerUA --> Received: "' + message.utf8Data + '"');

      var msg = JSON.parse(message.utf8Data);
      if (msg.status === 200 && msg.messageType == 'hello') {
        debug('UA registered');
        callback(null, connection);
        callback = function() {};
        client.removeAllListeners();
        connection.removeAllListeners();
        clearTimeout(timeout);
      } else {
        callback('registerUA --> Status is=' + msg.status + ' and messageType=' + msg.messageType);
        callback = function() {};
        client.removeAllListeners();
        connection.removeAllListeners();
        clearTimeout(timeout);
      }
    });
  });
  client.connect(WS, 'push-notification');
};


var registerWA = function (connection, callback) {
  console.log('registerWA()');

  var timeout = setTimeout(function() {
    callback('registerWA --> TIMEOUT');
    connection.removeAllListeners();
  }, OPS_TIMEOUT);

  var msg = '{"channelID": "testApp", "messageType":"register" }';
  if (!connection.connected) {
    callback('registerWA --> Connection is down');
    callback = function() {};
    clearTimeout(timeout);
    return;
  }
  connection.sendUTF(msg.toString());
  
  connection.on('error', function(error) {
    console.log('Connection Error: ' + error.toString());
    callback('registerWA -->' + error.toString());
    callback = function() {};
    connection.removeAllListeners();
    clearTimeout(timeout);
  });
  connection.on('close', function(error) {
    console.log('Connection closed: ' + error.toString());
    callback('registerWA -->' + error.toString());
    callback = function() {};
    connection.removeAllListeners();
    clearTimeout(timeout);
  });
  connection.on('message', function(message) {
    if (message.type !== 'utf8') {
      callback('registerWA --> Message is not UTF8');
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
      return;
    }
    debug('registerWA --> Received: "' + message.utf8Data + '"');

    var msg = JSON.parse(message.utf8Data);

    if (msg.status === 200 && msg.messageType === 'register' && msg.pushEndpoint) {
      debug('WA registered');
      callback(null, connection, msg.pushEndpoint);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
    } else {
      callback('registerWA --> Status is=' + msg.status + ' and messageType=' + msg.messageType);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
    }
  });
};

var sendNotification = function(connection, pushEndpoint, callback) {
  console.log('sendNotification()');

  var timeout = setTimeout(function() {
    callback('sendNotification --> TIMEOUT');
    callback = function() {};
  }, OPS_TIMEOUT);

  var body = 'version=' + (new Date()).getTime();
  request.put(pushEndpoint, { body: body }, function (error, response /*, body*/) {
    if (error) {
      callback('sendNotification --> ' + error.toString());
      callback = function() {};
      clearTimeout(timeout);
      return;
    }
    if (response.statusCode !== 200) {
      callback('sendNotification --> Bad statusCode=' + response.statusCode);
      callback = function() {};
      clearTimeout(timeout);
      return;
    }
    callback(null, connection);
    callback = function() {};
    clearTimeout(timeout);
  });
};

var notificationReceived = function(connection, callback) {
  console.log('notificationReceived()');
  
  var timeout = setTimeout(function() {
    callback('notificationReceived --> TIMEOUT');
    callback = function() {};
    connection.removeAllListeners();
  }, OPS_TIMEOUT);

  connection.on('error', function(error) {
    console.log('Connection Error: ' + error.toString());
    callback('notificationReceived -->' + error.toString());
    callback = function() {};
    connection.removeAllListeners();
    clearTimeout(timeout);
  });
  connection.on('close', function(error) {
    console.log('Connection closed: ' + error.toString());
    callback('notificationReceived -->' + error.toString());
    callback = function() {};
    connection.removeAllListeners();
    clearTimeout(timeout);
  });
  connection.on('message', function(message) {
    if (message.type !== 'utf8') {
      callback('notificationReceived --> Message is not UTF8');
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
      return;
    }
    debug('notificationReceived --> Received: "' + message.utf8Data + '"');

    var msg = JSON.parse(message.utf8Data);

    if (!Array.isArray(msg.updates)) {
      callback('notificationReceived --> notifications are not an array');
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
      return;
    }

    if (msg.messageType === 'notification') {
      callback(null, connection, msg.updates);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
    } else {
      callback('notificationReceived --> messageType=' + msg.messageType);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
    }
  });
};

var sendACK = function(connection, updates, callback) {
  var timeout = setTimeout(function() {
    callback('sendACK --> TIMEOUT');
    callback = function() {};
  }, OPS_TIMEOUT);

  var msg = {
    messageType: 'ack',
    updates: updates
  };
  if (connection.connected) {
    connection.sendUTF(JSON.stringify(msg));
    callback(null);
    callback = function() {};
    clearTimeout(timeout);
  } else {
    callback('sendACK --> Not connected!!');
    callback = function() {};
    clearTimeout(timeout);
  }
};

/**
 * Beautiful.
 */
async.waterfall([
  registerUA,
  registerWA,
  sendNotification,
  notificationReceived,
  sendACK
  ], function(error/*, results*/) {
    if (error) {
      console.log(error);
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
);
