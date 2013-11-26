/**
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

var common = require('./common'),
    debug = common.debug,
    async = require('async'),
    request = require('request'),
    fs = require('fs'),
    dgram = require('dgram');

var WS = process.argv[2];
var PORT = 44444;
var IP = '127.0.0.1';

var registerUA = function (callback) {
  var WebSocketClient = require('websocket').client;
  var client = new WebSocketClient();

  client.on('connectFailed', function(error) {
    console.log('registerUA --> Connect Error: ' + error.toString());
  });

  client.on('connect', function(connection) {
    debug('WebSocket client connected');

    if (connection.connected) {
      var msg = '{"uaid":null,"wakeup_hostport":{"ip":"' + IP + '","port":' + PORT + '},"mobilenetwork":{"mcc":"214","mnc":"07"},"protocol":"udp","messageType":"hello"}';
      connection.sendUTF(msg.toString());
    } else {
      callback('registerUA --> Not connected');
      callback = function() {};
      return;
    }


    connection.on('error', function(error) {
      console.log('registerUA --> Connection Error: ' + error.toString());
      callback(error.toString());
      callback = function() {};
    });
    connection.on('close', function(error) {
      console.log('registerUA --> Connection closed: ' + error.toString());
      callback('registerUA --> ' + error.toString());
      callback = function() {};
    });
    connection.on('message', function(message) {
      if (message.type !== 'utf8') {
        callback('registerUA --> Message not UTF8');
        callback = function() {};
        return;
      }
      debug("Received: '" + message.utf8Data + "'");

      var msg = JSON.parse(message.utf8Data);
      debug(msg);
      if (msg.status === 201 && msg.messageType == "hello") {
        debug("UA registered");
        callback(null, connection);
        callback = function() {};
        connection.removeAllListeners();
      } else {
        callback('registerUA --> Status is=' + msg.status + ' and messageType=' + msg.messageType);
        callback = function() {};
      }
    });
  });
  client.connect(WS, 'push-notification');
};


var registerWA = function (connection, callback) {
  var msg = '{"channelID": "testApp", "messageType":"register" }';
  if (!connection.connected) {
    callback('registerWA --> Connection is down');
    callback = function() {};
    return;
  }
  connection.sendUTF(msg.toString());
  
  connection.on('error', function(error) {
    console.log("Connection Error: " + error.toString());
    callback('registerWA -->' + error.toString());
    callback = function() {};

  });
  connection.on('close', function(error) {
    console.log("Connection closed: " + error.toString());
    callback('registerWA -->' + error.toString());
    callback = function() {};

  });
  connection.on('message', function(message) {
    if (message.type !== 'utf8') {
      callback('registerWA --> Message is not UTF8');
      callback = function() {};

      return;
    }
    debug("Received: '" + message.utf8Data + "'");

    var msg = JSON.parse(message.utf8Data);
    debug(msg);

    if (msg.status === 200 && msg.messageType === "register" && msg.pushEndpoint) {
      debug("WA registered");
      callback(null, connection, msg.pushEndpoint);
      callback = function() {};
      connection.removeAllListeners();
    } else {
      callback('registerWA --> Status is=' + msg.status + ' and messageType=' + msg.messageType);
      callback = function() {};
    }
  });
};

var disconnectedForUDP = function(connection, pushEndpoint, callback) {
  var timeout = setTimeout(function() {
    callback('disconnectedForUDP --> Not closed correctly');
    callback = function() {};
  }, 12000);

  connection.on('error', function(error) {
    callback('disconnectedForUDP -->' + error.stack);
    callback = function() {};
  });
  connection.on('close', function(error) {
    if (error === 4774) {
      callback(null, connection, pushEndpoint);
      callback = function() {};
      clearTimeout(timeout);
      connection.removeAllListeners();
    } else {
      callback('disconnectedForUDP --> No correct close code=' + error);
      callback = function() {};
    }
  });
};

var sendNotification = function(connection, pushEndpoint, callback) {
  var body = 'version=' + (new Date()).getTime();
  request.put(pushEndpoint, { body: body }, function (error, response, body) {
    if (error) {
      callback('sendNotification --> ' + error.toString());
      callback = function() {};
      return;
    }
    if (response.statusCode !== 200) {
      callback('sendNotification --> Bad statusCode=' + response.statusCode);
      callback = function() {};
      return;
    }
    callback(null);
    callback = function() {};

  });
};

var notificationReceived = function(connection, callback) {
  connection.on('error', function(error) {
    console.log("Connection Error: " + error.toString());
    callback('notificationReceived -->' + error.toString());
    callback = function() {};

  });
  connection.on('close', function(error) {
    console.log("Connection closed: " + error.toString());
    callback('notificationReceived -->' + error.toString());
    callback = function() {};

  });
  connection.on('message', function(message) {
    if (message.type !== 'utf8') {
      callback('notificationReceived --> Message is not UTF8');
      callback = function() {};
      return;
    }
    debug("Received: '" + message.utf8Data + "'");

    var msg = JSON.parse(message.utf8Data);
    debug(msg);

    if (!Array.isArray(msg)) {
      callback('notificationReceived --> notifications are not an array');
      callback = function() {};
      return;
    }

    if (msg[0].status === 200 && msg[1].messageType === "notification") {
      callback(null, version, pushEndpoint);
      callback = function() {};

    } else {
      callback('notificationReceived --> Status is=' + msg[0].status + ' and messageType=' + msg[0].messageType);
      callback = function() {};

    }
  });
};

var notificationUDPReceived = function(callback) {

  var timeout = setTimeout(function() {
    callback('notificationUDPReceived --> I have not received nothing :(');
    callback = function() {};
  }, 12000);

  var server = dgram.createSocket("udp4");

  server.on("error", function (err) {
    console.log("server error:\n" + err.stack);
    callback(err.stack);
    callback = function() {};
    server.close();
  });

  server.on("message", function (msg, rinfo) {
    console.log("server got: " + msg + " from " +
      rinfo.address + ":" + rinfo.port);
    callback(null);
    callback = function() {};
    clearTimeout(timeout);
  });
  
  server.bind(PORT);
};

/**
 * Beautiful.
 */
async.waterfall([
  registerUA,
  registerWA,
  disconnectedForUDP,
  sendNotification,
  notificationUDPReceived
  ], function(error, results) {
    if (error) {
      console.log(error);
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
);