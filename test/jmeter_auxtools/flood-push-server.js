/* jshint node: true */
"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var https = require('https');
var url = require('url');

var debug = function(message) {
  console.log((new Date().toLocaleString()) + ' - ' + message);
}

var sendRegister = function(connection) {
  connection.sendUTF('{"channelID":"1234","messageType":"register"}');
};

var sendNotification = function(where, version) {
  var u = url.parse(where);
  var options = {
    hostname: u.hostname,
    port: u.port,
    path: u.path,
    method: 'PUT',
    agent: new https.Agent(false)
  };

  var req = https.request(options, function(res) {
    debug('notification sent to ' + where + ' version=' + version + ' - ' + res.statusCode);
  });

  req.on('error', function(e){
	debug('error sending!!' +  e);
});



  req.write('version=' + version);
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
var poolPong = {};
var poolMessages = {};
var INTERVALS = [];
var id = 0;
var total = 0;
var closed = [];


var newConnection = function newConnection() {
  var conn = new wsClient();
  conn.on('connectFailed', function(error) {
    debug('Connect Error: ' + error.toString());
  });
  conn.on('connect', function(connection) {
    var version = Math.floor(Math.random()*100000);
    var identifier = id++;
    debug('connected on' + identifier);

    poolConnections[identifier] = connection;
    connection.identifier = identifier;

    connection.sendUTF('{ "messageType": "hello"}');

    connection.on('error', function(error) {
      closed[identifier] = true;
      debug("Connection Error on" + identifier + " -- " + error.toString());
    });
    connection.on('close', function() {
      closed[identifier] = true;
      debug('Connection ' + identifier + ' closed');
    });
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
          sendNotification(json.pushEndpoint, version);
          debug('received register on conn=' + identifier);
        } else if (json.messageType === 'notification') {
          poolMessages[identifier] = true;
          debug('received notification on conn=' + identifier);
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
  console.log('poolMessages.keys.length=' + Object.keys(poolMessages).length);
  poolConnections.forEach(function(conn) {
    if (conn && conn.connected) {
      debug('sending ping to ' + conn.identifier)
      conn.sendUTF('{}');
    }
  });
}, ARGS[6]-120000);

setTimeout(function killItWithFire() {
  console.log('There are ' + Object.keys(poolPong).length +  ' connections alive, and we started ' + total +
    ', with ' + id + ' really opened');
  process.exit();
}, ARGS[6]);
