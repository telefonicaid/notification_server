/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js"),
    msgBroker = require("../common/msgbroker.js"),
    mn = require("../common/mobilenetwork.js"),
    http = require('http');

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////

function onNewMessage(message) {
  log.debug("MB: " + message);
  var messageData = {};
  try {
    messageData = JSON.parse(message);
  } catch(e) {
    log.debug('WS::Queue::onNewMessage --> Not a valid JSON');
    return;
  }

  // Notify the hanset with the associated Data
  log.debug("Notifying node: " + JSON.stringify(messageData.uatoken));
  log.debug("Notify to " +
      messageData.data.interface.ip + ":" + messageData.data.interface.port +
      " on network " +
      messageData.data.mobilenetwork.mcc + "-" + messageData.data.mobilenetwork.mnc
  );

  mn.getNetwork(messageData.data.mobilenetwork.mcc, messageData.data.mobilenetwork.mnc, function(op) {
    if(op && op.wakeup) {
      log.debug("onNewMessage: UDP WakeUp server for " + op.operator + ": " + op.wakeup);

      // Send HTTP Notification Message
      var options = {
        host: op.wakeup.split(":")[0],
        port: op.wakeup.split(":")[1],
        path: '/?ip=' + messageData.data.interface.ip + '&port=' + messageData.data.interface.port,
        method: 'GET'
      };

      var req = http.request(options, function(res) {
        log.debug('Message status: ' + res.statusCode);
      });

      req.on('error', function(e) {
        log.debug('problem with request: ' + e.message);
      });

      req.end();
    } else {
      log.error("onNewMessage: No WakeUp server found");
    }
  }.bind(this));
}

////////////////////////////////////////////////////////////////////////////////

function server() {
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    log.info("Starting UA-UDP server");

    // Subscribe to the UDP common Queue
    msgBroker.init(function() {
      var args = { durable: false, autoDelete: true, arguments: { 'x-ha-policy': 'all' } };
      msgBroker.subscribe("UDP", args, function(msg) { onNewMessage(msg); });
    });
  },

  stop: function(callback) {
    log.info("UDP::stop --> Closing UDP server");

    //Closing connection with msgBroker
    msgBroker.close();

    //Calling the callback
    callback(null);
  }
};

// Exports
exports.server = server;
