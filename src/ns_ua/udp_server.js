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
    http = require('http'),
    https = require('https'),
    urlparser = require('url');

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
   * {
   *  "uaid": "<UAID>",
   *  "dt": {
   *    "wakeup_hostport": {
   *      "ip": "IP",
   *      "port": "PORT"
   *    },
   *    "mobilenetwork": {
   *      "mcc": "MCC",
   *      "mnc": "MNC"
   *    },
   *    "protocol": "udp|tcp",
   *    "canBeWakeup": "true|false",
   *    "payload": {
   *      "app": "<appToken>",
   *      "ch": "<channelID>",
   *      "vs": "x"
   *    }
   *  }
   * }
   */
  // If message does not follow the above standard, return.
  log.debug('UDP::queue::onNewMessage --> messageData =', messageData);
  if (!messageData.uaid ||
     !messageData.dt ||
     !messageData.dt.wakeup_hostport ||
     !messageData.dt.wakeup_hostport.ip ||
     !messageData.dt.wakeup_hostport.port ||
     !messageData.dt.mobilenetwork ||
     !messageData.dt.mobilenetwork.mcc ||
     !messageData.dt.mobilenetwork.mnc) {
    return log.error('UDP::queue::onNewMessage --> Not enough data to find server');
  }

  // Notify the hanset with the associated Data
  log.notify(log.messages.NOTIFY_NOTIFINGNODE, {
    uaid: messageData.uaid,
    wakeupip: messageData.dt.wakeup_hostport.ip,
    wakeupport: messageData.dt.wakeup_hostport.port,
    mcc: messageData.dt.mobilenetwork.mcc,
    mnc: messageData.dt.mobilenetwork.mnc,
    protocol: mcc: messageData.dt.protocol
  });

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
    var address = urlparser.parse(op.wakeup);

    if (!address.href) {
      log.error('UDP:queue:onNewMessage --> Bad address to notify', address);
      return;
    }

    var protocolHandler = null;
    switch (address.protocol) {
    case 'http:':
      protocolHandler = http;
      break;
    case 'https:':
      protocolHandler = https;
      break;
    default:
      protocolHandler = null;
    }
    if (!protocolHandler) {
      log.debug('UDP:queue:onNewMessage --> Non valid URL (invalid protocol)');
      return;
    }
    var req = protocolHandler.get(address.href +
      '/?ip=' + messageData.dt.wakeup_hostport.ip +
      '&port=' + messageData.dt.wakeup_hostport.port +
      '&proto=' + messageData.dt.protocol,
      function(res) {
        res.on('data', function(d) {
          log.debug('UDP:WakeUpConnection response: ' + d);
        });
      }).on('error', function(e) {
        log.debug('UDP:WakeUpConnection error: ' + e);
      });
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
