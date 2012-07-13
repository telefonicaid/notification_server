/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var stomp = require('stomp');
var log = require("./logger.js").getLogger;
var queueconf = require("../config.js").queue;

function msgBroker() {}

msgBroker.prototype = {
  init: function(onConnect) {
    this.queue = new stomp.Stomp({
      port: queueconf.port,
      host: queueconf.host,
      debug: queueconf.debug,
      // login and passcode may be optional (required by rabbitMQ)
      login: queueconf.user,
      passcode: queueconf.password
    });

    this.queue.connect();
    // Queue Events
    this.queue.on('connected', onConnect);
    this.queue.on('receipt', function(receipt) {
      log.debug("RECEIPT: " + receipt);
    });
    this.queue.on('error', (function(error_frame) {
      log.error('We cannot connect to the message broker on ' + queueconf.host + ':' + queueconf.port + ' -- ' + queueconf.body);
      this.close();
    }).bind(this));
    log.debug("Connected to Message Broker");
  },

  close: function() {
    if(this.queue) {
      this.queue.disconnect();
      this.queue = null;
    }
  },

  subscribe: function(queueName, callbackFunc) {
    this.queue.on('message', callbackFunc);
    this.queue.subscribe({
      destination: '/queue/' + queueName,
      ack: 'client'
    });
    log.debug("Subscribed to Message Broker /queue/" + queueName);
  },

  /**
   * Insert a new message into the queue
   */
  push: function(queueName, body, persistent) {
    log.debug('Going to send ' + body);
    this.queue.send({
      'destination': '/queue/' + queueName,
      'body': body.toString(),
      'persistent': persistent
    }, true); //receipt
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _msgBroker = new msgBroker();
function getMsgBroker() {
  return _msgBroker;
}
exports.getMsgBroker = getMsgBroker;
