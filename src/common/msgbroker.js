/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var stomp = require('stomp');
var log = require("./logger.js").getLogger;
var queueconf = require("../config.js").queue;
var events = require("events");
var util = require("util");

var MsgBroker = function() {
  events.EventEmitter.call(this);
  this.init = function(onConnect) {
    //If we are in travis, use the RabbitMQ
    if (process.env.TRAVIS) {
      log.info('We are on travis-ci \\o/');
      queueconf.port = 5672;
    }
    log.info('msgBroker::queue.init --> Connecting to the queue server');
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
      this.emit('brokerconnected');
      if (onConnect) onConnect();
    }).bind(this));
    this.queue.on('receipt', function(receipt) {
      log.debug("msgbroker::queue.onreceipt --> RECEIPT: " + receipt);
    });
    this.queue.on('error', (function(error_frame) {
      log.error('msgbroker::queue.onerror --> We cannot connect to the message broker on ' + queueconf.host + ':' + queueconf.port + ' -- ' + error_frame.body);
      this.close();
    }.bind(this)));
  };

  this.close = function() {
    if(this.queue) {
      this.queue.disconnect();
      this.queue = null;
    }
    log.info('msgbroker::close --> Closing connection to msgBroker');
  };

  this.subscribe = function(queueName, callbackFunc) {
    this.queue.on('message', callbackFunc);
    this.queue.subscribe({
      destination: '/queue/' + queueName,
      ack: 'auto'
    });
    log.debug("msgbroker::subscribe --> Subscribed to Message Broker /queue/" + queueName);
  };

  /**
   * Insert a new message into the queue
   */
  this.push = function(queueName, body, persistent) {
    log.debug('msgbroker::push --> Going to send ' + JSON.stringify(body));
    this.queue.send({
      'destination': '/queue/' + queueName,
      'body': JSON.stringify(body),
      'persistent': persistent
    }, true); //receipt
  };
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
util.inherits(MsgBroker, events.EventEmitter);

var _msgbroker = new MsgBroker();
function getMsgBroker () {
  return _msgbroker;
}

module.exports = getMsgBroker();
