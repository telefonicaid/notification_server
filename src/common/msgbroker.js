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
    if (process.env.TRAVIS) queueconf.port = 5672;
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
    this.queue.on('connected', (function() {
      log.info("msgbroker::queue.onconnected --> Connected to Message Broker");
      onConnect();
    }));
    this.queue.on('receipt', function(receipt) {
      log.debug("msgbroker::queue.onreceipt --> RECEIPT: " + receipt);
    });
    this.queue.on('error', (function(error_frame) {
      log.error('msgbroker::queue.onerror --> We cannot connect to the message broker on ' + queueconf.host + ':' + queueconf.port + ' -- ' + error_frame.body);
      this.close();
    }).bind(this));
  },

  close: function() {
    if(this.queue) {
      this.queue.disconnect();
      this.queue = null;
    }
    log.info('msgbroker::close --> Closing connection to msgBroker');
  },

  subscribe: function(queueName, callbackFunc) {
    this.queue.on('message', callbackFunc);
    this.queue.subscribe({
      destination: '/queue/' + queueName,
      ack: 'auto'
    });
    log.debug("msgbroker::subscribe --> Subscribed to Message Broker /queue/" + queueName);
  },

  /**
   * Insert a new message into the queue
   */
  push: function(queueName, body, persistent) {
    log.debug('msgbroker::push --> Going to send ' + JSON.stringify(body));
    this.queue.send({
      'destination': '/queue/' + queueName,
      'body': JSON.stringify(body),
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

//Testing vars
//var TESTING = require("../consts.js").consts.TESTING;
if (false/*TESTING*/) {
  var getMsgBrokerMock = require("./msgbroker-mock.js").getMsgBroker;
  exports.getMsgBroker = getMsgBrokerMock;
} else {
  exports.getMsgBroker = getMsgBroker;
}