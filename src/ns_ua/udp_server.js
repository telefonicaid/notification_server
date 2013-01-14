/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js'),
    msgBroker = require('../common/msgbroker.js'),
    mn = require('../common/mobilenetwork.js'),
    http = require('http');

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////

function onNewMessage(message) {
  log.debug('UDP::Queue::onNewMessage: ' + message);
  var messageData = {};
  try {
    messageData = JSON.parse(message);
  } catch (e) {
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
  log.debug('UDP::queue::onNewMessage --> messageData =', messageData);
  if (!messageData.uatoken ||
     !messageData.dt ||
     !messageData.dt.interface ||
     !messageData.dt.interface.ip ||
     !messageData.dt.interface.port ||
     !messageData.dt.mobilenetwork ||
     !messageData.dt.mobilenetwork.mcc ||
     !messageData.dt.mobilenetwork.mnc) {
    return log.error('UDP::queue::onNewMessage --> Not enough data to find server');
  }

  // Notify the hanset with the associated Data
  log.notify('Notifying node: ' + messageData.uatoken +
      ' to ' + messageData.dt.interface.ip +
      ':' + messageData.dt.interface.port +
      ' on network ' + messageData.dt.mobilenetwork.mcc +
      '-' + messageData.dt.mobilenetwork.mnc +
      ' and using protocol: ' + messageData.dt.protocol
  );

  mn.getNetwork(messageData.dt.mobilenetwork.mcc, messageData.dt.mobilenetwork.mnc, function(error, op) {
    if (error) {
      log.error('UDP::queue::onNewMessage --> Error getting the operator from the DB: ' + error);
      return;
    }
    if (!op || !op.wakeup) {
      log.debug('UDP::queue::onNewMessage --> No WakeUp server found');
      return;
    }
    log.debug('onNewMessage: UDP WakeUp server for ' + op.operator + ': ' + op.wakeup);

    // Send HTTP Notification Message
    var address = {};
    address.host = op.wakeup.split(':')[0] || null;
    address.port = op.wakeup.split(':')[1] || null;

    if (!address.host || !address.port) {
      log.error('UDP:queue:onNewMessage --> Bad address to notify', address);
      return;
    }

    var options = {
      host: address.host,
      port: address.port,
      path: '/?ip=' + messageData.dt.interface.ip + '&port=' + messageData.dt.interface.port + '&proto=' + messageData.dt.protocol,
      method: 'GET'
    };

    var req = http.request(options, function(res) {
      log.debug('Message status: ' + res.statusCode);
    });

    req.on('error', function(e) {
      log.debug('problem with request: ' + e.message);
    });

    req.end();
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
    log.info('NS_UDP:init --> Starting UA-UDP server');

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
      msgBroker.subscribe('UDP', args, function(msg) { onNewMessage(msg); });
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
    }, 30 * 1000); //Wait 30 seconds

  },

  stop: function() {
    this.ready = false;
    log.info('NS_UDP:stop --> Closing UDP server');

    //Closing connection with msgBroker
    msgBroker.close();
  }
};

// Exports
exports.server = server;
