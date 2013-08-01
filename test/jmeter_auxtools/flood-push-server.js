/* jshint node: true */
"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var https = require('https');
var url = require('url');

var sendRegister = function(connection) {
  connection.sendUTF('{"channelID":"1234","messageType":"register"}');
};

var sendNotification = function(where) {
  var u = url.parse(where);
  var options = {
    hostname: u.hostname,
    path: u.path,
    method: 'PUT'
  };

  var req = https.request(options, function(res) {});

  req.on('error', function(){});

  req.write('version=3\n');
  req.end();
};

var wsClient = require('websocket').client;

var ARGS = [];
if (process.argv.length < 9) {
  console.error('You must use 7 parameters, like this');
  console.error('node script.js <IP> <Port> <Number of conn> <Interval between starts> <Number of chars> <Interval> <Time to kill>');
  console.error('all intervals are in milliseconds');
  process.exit(1);
}

if (process.argv[8] < 5000) {
  console.error('Time to kill (last parameter) must be GREATER than 5 seconds');
  process.exit(1);
}

for (var i = 2; i<process.argv.length; i++) {
  ARGS.push(process.argv[i]);
}

var WSADRESS = 'wss://'+ARGS[0]+':'+ARGS[1]+'/',
    PROTOCOL = 'push-notification';

var poolConnections = [];
var poolPong = [];
var INTERVALS = [];
var id = 0;
var total = 0;
var closed = [];


var newConnection = function newConnection() {
  var conn = new wsClient();
  conn.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
  });
  conn.on('connect', function(connection) {
    var identifier = id++;
    console.log('connected on' + identifier);

    poolConnections[identifier] = connection;

    connection.sendUTF('{ "messageType": "hello"}');

    connection.on('error', function(error) {
      closed[identifier] = true;
      console.log("Connection Error on" + identifier + " -- " + error.toString());
    });
    connection.on('close', function() {
      closed[identifier] = true;
      console.log('Connection ' + identifier + ' closed');
    });
    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        var json = JSON.parse(message.utf8Data);
        if (message.utf8Data === '{}') {
          poolPong[identifier] = true;
        } else if (json.messageType === 'hello') {
          sendRegister(connection);
        } else if (json.messageType === 'register' && json.pushEndpoint) {
          sendNotification(json.pushEndpoint);
        }
      }
    });

    var interval = setInterval(function() {
      if (closed[identifier]) {
        clearInterval(interval);
        poolConnections[identifier] = null;
        return;
      }
      connection.sendUTF('{ "messageType": "hello" }');
    }, ARGS[5]);
    INTERVALS.push(interval);
  });
  conn.connect(WSADRESS, PROTOCOL);
  total++;
};

var getter = setInterval(function() {
  newConnection();
  if (total >= ARGS[2]) {
    clearInterval(getter);
  }
}, ARGS[3]);

setTimeout(function stopInitial() {
  console.log('Stopping getting new connections.');
  console.log('We started ' + total + ', hoping to open ' + ARGS[2]);
  clearInterval(getter);
}, ARGS[6]-140000);

setTimeout(function checkAliveConnections() {
  INTERVALS.forEach(function(elem) {
    clearInterval(elem);
  });

  console.log('poolConnections.length=' + poolConnections.length);
  poolConnections.forEach(function(conn) {
    if (conn && conn.connected) {
      conn.sendUTF('{}');
    }
  });
}, ARGS[6]-120000);

setTimeout(function killItWithFire() {
  console.log('There are ' + poolPong.length +  ' connections alive, and we started ' + total +
    ', with ' + id + ' really opened');
  process.exit();
}, ARGS[6]);
