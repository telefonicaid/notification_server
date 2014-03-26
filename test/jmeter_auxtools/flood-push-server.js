/* jshint node: true */
'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var request = require('request');
var http = require('http');
http.globalAgent.maxSockets = 20000;
var https = require('https');
https.globalAgent.maxSockets = 20000;

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
}

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}

var poolConnections = [];
var poolPong = {};
var poolMessages = {};
var INTERVALS = [];
var id = 0;
var total = 0;
var closed = [];
var finishing = false;

var HELLOS_RECEIVED = 0;
var REGISTER_RECEIVED = 0;
var NOTIFICATIONS_SENT_OK = 0;
var NOTIFICATIONS_RECEIVED = 0;
var NOTIFICATIONS_TRIED = 0;
var NOTIFICATIONS_SENT_BAD = 0;


var debug = function(message) {
  console.log((new Date().toLocaleString()) + ' - ' + message);
};

var sendRegister = function(connection) {
  connection.sendUTF('{"channelID":"' + guid() + '","messageType":"register"}');
};

var sendNotification = function(idcon, where, version) {
  if (!where || !version || finishing) return;
  NOTIFICATIONS_TRIED++;
  var options = {
    url: where,
    method: 'PUT',
    agent: false,
    pool: {
      maxSockets: 40000
    },
    headers: {
      'Connection': 'close'
    },
    body: 'version=' + version
  };

  request(options, function(error, message/*, response*/) {
    if (error) {
      debug('(conn ' + idcon + ') error sending!! ' + require('util').inspect(error));
      NOTIFICATIONS_SENT_BAD++;
      return;
    }
    if (message && (message.statusCode === 200)) {
      debug('(conn ' + idcon + ') notification sent to url=' + where + ' version=' +
      version + ' - ' + message.statusCode);
      NOTIFICATIONS_SENT_OK++;
    } else {
      debug('(conn ' + idcon + ') notification ERROR to url=' + where + ' version=' +
      version + ' - ' + message.statusCode);
      NOTIFICATIONS_SENT_BAD++;
    }
  });
};

var wsClient = require('websocket').client;

var ARGS = [];
if (process.argv.length < 9) {
  console.error('You must use 7 parameters, like this');
  console.error('node script.js <IP> <Port> <Number of conn> ' +
    '<Interval between start connections> <ACK delay> ' +
    '<Notification interval> <Time to kill>');
  console.error('all intervals are in milliseconds');
  process.exit(1);
}

if (process.argv[8] < 5000) {
  console.error('Time to kill (last parameter) must be GREATER than 5 seconds');
  process.exit(1);
}

for (var i = 2; i < process.argv.length; i++) {
  ARGS.push(process.argv[i]);
}

var WSADRESS = 'wss://' + ARGS[0]+':'+ARGS[1]+'/',
    PROTOCOL = 'push-notification';

var newConnection = function newConnection() {
  var conn = new wsClient();
  conn.on('connectFailed', function(error) {
    debug('Connect Error: ' + error.toString());
  });
  conn.on('connect', function(connection) {
    var identifier = id++;
    debug('(conn ' + identifier + ') connected');

    poolConnections[identifier] = connection;
    connection.identifier = identifier;

    connection.sendUTF('{ "messageType": "hello"}');

    connection.on('error', function(error) {
      closed[identifier] = true;
      debug('(conn ' + identifier + ') error ' + error.toString());
    });
    connection.on('close', function() {
      closed[identifier] = true;
      debug('(conn ' + identifier + ') closed');
    });
    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        var json = JSON.parse(message.utf8Data);
        //debug(message.utf8Data);
        if (poolMessages[identifier] == null) {
          poolMessages[identifier] = 0;
        }
        if (message.utf8Data === '{}') {
          poolPong[identifier] = true;
        } else if (json.messageType === 'hello') {
          HELLOS_RECEIVED++;
          connection.uaid = json.uaid;
          sendRegister(connection);
          debug('(conn ' + identifier + ') received hello');
        } else if (json.messageType === 'register' && json.pushEndpoint) {
          REGISTER_RECEIVED++;
          connection.pushEndpoint = json.pushEndpoint;
          sendNotification(identifier, json.pushEndpoint, Math.floor(Math.random()*100000));
          debug('(conn ' + identifier + ') received register');
        } else if (json.messageType === 'notification') {
          poolMessages[identifier]++;

          json.updates.forEach(function(e) {
            debug('(conn ' + identifier + ') received notification version=' + e.version);
          });
          NOTIFICATIONS_RECEIVED++;
          setTimeout(function() {
            json.updates.forEach(function onEachUpdate(update) {
              var send = '{"messageType": "ack", "updates":[' + JSON.stringify(update) + ']}';
              connection.sendUTF(send);
            });
          }, ARGS[4]);
        }
      }
    });

    var interval = setInterval(function() {
      if (closed[identifier]) {
        clearInterval(interval);
        poolConnections[identifier] = null;
        return;
      }
      sendNotification(identifier, connection.pushEndpoint, Math.floor(Math.random() * 100000));
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

setTimeout(function checkAliveConnections() {
  finishing = true;
  console.log('Stopping getting new connections.');
  console.log('We started ' + total + ', hoping to open ' + ARGS[2]);
  clearInterval(getter);


  INTERVALS.forEach(function(elem) {
    clearInterval(elem);
  });

  console.log('poolConnections.length=' + poolConnections.length);
  console.log('poolMessages.keys.length=' + Object.keys(poolMessages).length);
  poolConnections.forEach(function(conn) {
    if (conn && conn.connected) {
      debug('sending ping to ' + conn.identifier);
      conn.sendUTF('{}');
    }
  });
}, ARGS[6] - 140000);

setTimeout(function killItWithFire() {
  console.log('------------------ Summary ------------------');
  console.log('Requested connections=' + ARGS[2]);
  console.log('Started to open=' + total);
  console.log('Connection fulfilled=' + id);
  console.log('Actual open connections=' + Object.keys(poolPong).length);
  console.log('Hellos received=' + HELLOS_RECEIVED);
  console.log('Endpoints received=' + REGISTER_RECEIVED);
  console.log('Tried notifications=' + NOTIFICATIONS_TRIED);
  console.log('Notifications sent OK=' + NOTIFICATIONS_SENT_OK);
  console.log('Notifications sent BAD=' + NOTIFICATIONS_SENT_BAD);
  console.log('Notifications received=' + NOTIFICATIONS_RECEIVED);
  console.log('All in just ' + ARGS[6] / 1000 + ' seconds!!');
  console.log('------------------ Summary ------------------');
  process.exit();
}, ARGS[6]);
