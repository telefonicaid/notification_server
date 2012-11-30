/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
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
  log.debug("UDP::Queue::onNewMessage: " + message);
  var messageData = {};
  try {
    messageData = JSON.parse(message);
  } catch(e) {
    log.debug('UDP::Queue::onNewMessage --> Not a valid JSON');
    return;
  }

  /**
   * Messages are formed like this:
   * { "data": {
   *    "uatoken": "UATOKEN",
   *    "interface": {
   *      "ip": "IP",
   *      "port": "PORT"
   *    },
   *    "mobilenetwork": {
   *      "mcc": "MCC",
   *      "mnc": "MNC"
   *    }
   *  },
   *  "messageType": "registerUA"
   * }
   */
  // If message does not follow the above standard, return.
  if(!messageData.uatoken ||
     !messageData.data ||
     !messageData.data.interface ||
     !messageData.data.interface.ip ||
     !messageData.data.interface.port ||
     !messageData.data.mobilenetwork ||
     !messageData.data.mobilenetwork.mcc ||
     !messageData.data.mobilenetwork.mnc) {
    return log.error('UDP::queue::onNewMessage --> Not enough data to find server');
  }

  // Notify the hanset with the associated Data
  log.notify("Notifying node: " + messageData.data.uatoken +
      " to " + messageData.data.interface.ip +
      ":" + messageData.data.interface.port +
      " on network " + messageData.data.mobilenetwork.mcc +
      "-" + messageData.data.mobilenetwork.mnc +
      " and using protocol: " + messageData.data.protocol
  );

  mn.getNetwork(messageData.data.mobilenetwork.mcc, messageData.data.mobilenetwork.mnc, function(op) {
    if(op && op.wakeup) {
      log.debug("onNewMessage: UDP WakeUp server for " + op.operator + ": " + op.wakeup);

      // Send HTTP Notification Message
      var options = {
        host: op.wakeup.split(":")[0],
        port: op.wakeup.split(":")[1],
        path: '/?ip=' + messageData.data.interface.ip + '&port=' + messageData.data.interface.port + '&proto=' + messageData.data.protocol,
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
      // TODO: Remove Node from Mongo issue #63
    }
  }.bind(this));
}

////////////////////////////////////////////////////////////////////////////////

function server() {
  this.ready = false;
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    log.info("NS_UDP:init --> Starting UA-UDP server");

    var self = this;
    msgBroker.on('brokerconnected', function() {
      self.ready = true;
      var args = {
        durable: false,
        autoDelete: true,
        arguments: {
          'x-ha-policy': 'all'
        }
      };
      msgBroker.subscribe("UDP", args, function(msg) { onNewMessage(msg); });
    });

    msgBroker.on('brokerdisconnected', function() {
      self.ready = false;
      log.critical('ns_udp::init --> Broker DISCONNECTED!!');
    });

    // Subscribe to the UDP common Queue
    process.nextTick(function() {
      msgBroker.init();
    });

    //Check if we are alive
    setTimeout(function() {
      if (!self.ready)
        log.critical('30 seconds has passed and we are not ready, closing');
    }, 30*1000); //Wait 30 seconds

  },

  stop: function() {
    this.ready = false;
    log.info("NS_UDP:stop --> Closing UDP server");

    //Closing connection with msgBroker
    msgBroker.close();
  }
};

// Exports
exports.server = server;
