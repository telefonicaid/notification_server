/* jshint node: true */
"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


var ARGS = [];
for (var i = 2; i<process.argv.length; i++) {
  ARGS.push(process.argv[i]);
}
console.log(ARGS.length);

if (ARGS.length !== 5) {
  console.error('You must use 3 parameters, like this');
  console.error('node stress.js <IP> <Port> <Interval of open in ms between starts> <Time to keep the WS open> <Time between notificaitons>');
  process.exit(1);
}

var https = require('https');
var url = require('url');

var debug = function(message) {
  console.log((new Date().toLocaleString()) + ' - ' + message);
}

var sendRegister = function(connection) {
  connection.sendUTF('{"channelID":"1234","messageType":"register"}');
};

var sendNotification = function(where) {
  var version = Math.floor(Math.random()*100000);
  var u = url.parse(where);
  var options = {
    hostname: u.hostname,
    path: u.path,
    method: 'PUT',
    agent: false
  };

  var req = https.request(options, function(res) {
    debug('notification sent to ' + where + ' version=' + version + ' - ' + res.statusCode);
  });

  req.on('error', function(){});

  req.write('version=' + version);
  req.end();
};

var wsClient = require('websocket').client;

var WSADRESS = 'wss://'+ARGS[0]+':'+ARGS[1]+'/',
    PROTOCOL = 'push-notification';

var id = 0;

var newConnection = function newConnection() {
  var conn = new wsClient();
  var sendNotInterval = null;
  conn.on('connectFailed', function(error) {
    debug('Connect Error: ' + error.toString());
  });
  conn.on('connect', function(connection) {
    var identifier = id++;
    debug('connected on' + identifier);

    connection.identifier = identifier;

    connection.sendUTF('{ "messageType": "hello"}');

    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        var json = JSON.parse(message.utf8Data);
        debug(message.utf8Data);
        if (message.utf8Data === '{}') {
          poolPong[identifier] = true;
        } else if (json.messageType === 'hello') {
          sendRegister(connection);
          debug('received hello on conn=' + identifier);
        } else if (json.messageType === 'register' && json.pushEndpoint) {
          debug('received register on conn=' + identifier);
          sendNotification(json.pushEndpoint);
          sendNotInterval = setInterval(function() {
            sendNotification(json.pushEndpoint);
          }.bind(undefined, json.pushEndpoint), ARGS[4]);
        } else if (json.messageType === 'notification') {
          debug('received notification on conn=' + identifier);
        }
      }
    });

    connection.on('close', function() {
      debug('conn closed with id=' + identifier);
    });

    setTimeout(function() {
      clearInterval(sendNotInterval);
      connection.close();
    }, ARGS[3])
  });
  conn.connect(WSADRESS, PROTOCOL);
};

var getter = setInterval(function() {
  newConnection();
}, ARGS[2]);