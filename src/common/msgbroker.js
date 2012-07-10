/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var stomp = require('stomp');
var log = require("./logger.js").getLogger;
var ddbb_info = require("../config.js").ddbb;

function msgBroker() {}

msgBroker.prototype = {
  init: function(onConnect) {
    this.queue = new stomp.Stomp({
      port: ddbb_info.port,
      host: ddbb_info.host,
      debug: ddbb_info.debug,
      // login and passcode are optional (required by rabbitMQ)
      login: ddbb_info.user,
      passcode: ddbb_info.password
    });

    this.queue.connect();

    // Queue Events
    this.queue.on('connected', onConnect);
    this.queue.on('receipt', function(receipt) {
      console.log("RECEIPT: " + receipt);
    });
    this.queue.on('error', function(error_frame) {
      console.log("ERROR: " + error_frame.body);
      this.close();
    });
  },

  close: function() {
    if(this.queue) {
      this.queue.close();
      this.queue = null;
    }
  },

  subscribe: function(queueName, callbackFunc) {
    this.queue.on('message', callbackFunc);
    this.queue.subscribe({
      destination: '/queue/'+queueName,
      ack: 'auto'
    });
    log.debug("Subscribed to Message Broker /queue/" + queueName);
  },

  /**
   * Insert a new message into the queue
   */
  push: function(queueName, rawData, persistent) {
    console.log(JSON.stringify(rawData));
    if(typeof(rawData) == "object")
      rawData = JSON.stringify(rawData);

    this.queue.send({
      'destination': '/queue/'+queueName,
      'body': rawData,
      'persistent': persistent,
      'receipt': true
    });
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
