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
  if (process.argv.length < 5) {
    console.log('You need to supply the WebSocket to connect to');
    console.log('node E2E.js \'wss://ua.push.tefdigital.com:443/\' <time_in_seconds_btw_notifications> <ops_timeout>');
    process.exit(1);
  }
})();

var common = require('./common'),
    debug = common.debug,
    async = require('async'),
    request = require('request');
    
var WS = process.argv[2];
var TIMEOUT = process.argv[3] * 1000;
var OPS_TIMEOUT = process.argv[4] * 1000;
var DEBUG = false;

var debug = function(msg) {
  if (DEBUG) {
    console.log(Date.now() + ' -- ' + msg);
  }
};

var registerUA = function (callback) {
  debug('registerUA()');

  var timeout = setTimeout(function() {
    callback('registerUA --> TIMEOUT');
    client && client.removeAllListeners && client.removeAllListeners();
    conn && conn.removeAllListeners && conn.removeAllListeners();
  }, OPS_TIMEOUT);

  var WebSocketClient = require('websocket').client;
  var client = new WebSocketClient();
  var conn = null;

  client.on('connectFailed', function(error) {
    debug('registerUA --> Connect Error: ' + error.toString());
  });

  client.on('connect', function(connection) {
    debug('WebSocket client connected');
    conn = connection;

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
      debug('registerUA --> Connection Error: ' + error.toString());
      callback(error.toString());
      callback = function() {};
      client.removeAllListeners();
      connection.removeAllListeners();
      clearTimeout(timeout);
    });
    connection.on('close', function(error) {
      debug('registerUA --> Connection closed: ' + error.toString());
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
  debug('registerWA()');

  var timeout = setTimeout(function() {
    callback('registerWA --> TIMEOUT');
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
    debug('Connection Error: ' + error.toString());
    callback('registerWA -->' + error.toString());
    callback = function() {};
    connection.removeAllListeners();
    clearTimeout(timeout);
  });
  connection.on('close', function(error) {
    debug('Connection closed: ' + error.toString());
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
      callback(null, [connection, msg.pushEndpoint]);
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

var sendNotification = function(args, callback) {
  debug('sendNotification()');

  var timeout = setTimeout(function() {
    console.error('sendNotification --> TIMEOUT');
    callback(null, args[0]);
    callback = function() {};
  }, OPS_TIMEOUT);

  var body = 'version=' + (new Date()).getTime();
  request.put(args[1], { body: body }, function (error, response /*, body*/) {
    if (error) {
      console.error('sendNotification --> ' + error.toString());
    }
    if (response && response.statusCode !== 200) {
      console.error('sendNotification --> Bad statusCode=' + response.statusCode);
    }
    callback(null, args[0]);
    callback = function() {};
    clearTimeout(timeout);
  });
};

var notificationReceived = function(connection, callback) {
  debug('notificationReceived()');

  var timeout = setTimeout(function() {
    console.error('notificationReceived --> TIMEOUT');
    callback(null, [connection]);
    callback = function() {};
    connection.removeAllListeners();
  }, OPS_TIMEOUT);

  connection.on('error', function(error) {
    callback('notificationReceived -->' + error.toString());
    callback = function() {};
    connection.removeAllListeners();
    clearTimeout(timeout);
  });
  connection.on('close', function(error) {
    callback('notificationReceived -->' + error.toString());
    callback = function() {};
    connection.removeAllListeners();
    clearTimeout(timeout);
  });
  connection.on('message', function(message) {
    if (message.type !== 'utf8') {
      console.error('notificationReceived --> Message is not UTF8');
      callback(null, [connection]);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
      return;
    }
    debug('notificationReceived --> Received: "' + message.utf8Data + '"');

    var msg = JSON.parse(message.utf8Data);

    if (!Array.isArray(msg.updates)) {
      console.error('notificationReceived --> notifications are not an array');
      callback(null, [connection]);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
      return;
    }

    if (msg.messageType === 'notification') {
      callback(null, [connection, msg.updates]);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
    } else {
      console.error('notificationReceived --> messageType=' + msg.messageType);
      callback(null, [connection]);
      callback = function() {};
      connection.removeAllListeners();
      clearTimeout(timeout);
    }
  });
};

var sendACK = function(args, callback) {
  debug('sendACK()');

  var timeout = setTimeout(function() {
    console.error('sendACK --> TIMEOUT');
    callback(null);
    callback = function() {};
  }, OPS_TIMEOUT);

  var msg = {
    messageType: 'ack',
    updates: args[1] || []
  };
  if (args[0].connected) {
    args[0].sendUTF(JSON.stringify(msg));
    callback(null);
    callback = function() {};
    clearTimeout(timeout);
  } else {
    callback('sendACK --> Not connected!!');
    callback = function() {};
    clearTimeout(timeout);
  }
};

var foreverNotifications = function(args, callback) {
  debug('foreverNotifications()');
  async.waterfall([
    sendNotification.bind(undefined, args),
    notificationReceived,
    sendACK
  ], function(error, results) {
    if (error) {
      console.error('foreverNotifications --> ' + error.toString());
    }
    setTimeout(function() {
      callback(error, results);
    }, TIMEOUT);
  });
};

/**
 * Beautiful.
 */
async.waterfall([
  registerUA,
  registerWA
  ], function(error, results) {
    if (error) {
      console.error(error);
      console.error('This _SHOULD_ never be called');
      return;
    }
    async.forever(foreverNotifications.bind(undefined, results), function(error) {
      console.error('This _SHOULD_ never be called');
      console.error('forever --> ' + error.toString());
    });
  }
);
