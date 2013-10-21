"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var wsClient = require('websocket').client;

var conn = new wsClient();
conn.on('connectFailed', function(error) {
  console.log('Connect Error: ' + error.toString());
});
conn.on('connect', function(connection) {
  connection.sendUTF('{ "messageType": "hello", "uaid": null}');

  connection.on('error', function(error) {
    console.log("Connection Error: " + error.toString());
  });
  connection.on('close', function() {
    console.log('Connection ' + identifier + ' closed');
  });
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      if (message.utf8Data === '{}') {
        //poolPong[identifier] = true;
      }
    }
  });
});
conn.connect('wss://push-nv.srv.openwebdevice.com', '');
