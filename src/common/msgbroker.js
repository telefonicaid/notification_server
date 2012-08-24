/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

 var amqp = require('amqp');
 var log = require("./logger.js");
 var queueconf = require("../config.js").queue;
 var events = require("events");
 var util = require("util");

 var MsgBroker = function() {
  events.EventEmitter.call(this);
  this.init = function(onConnect) {
    log.info('msgBroker::queue.init --> Connecting to the queue server');

    //Create connection to the broker
    this.queue = amqp.createConnection({
      port: queueconf.port,
      host: queueconf.host,
      login: queueconf.login,
      password: queueconf.password
    });

    // Queue Events
    this.queue.on('ready', (function() {
      log.info("msgbroker::queue.ready --> Connected to Message Broker");
      this.emit('brokerconnected');
      if (onConnect) onConnect();
    }).bind(this));

    this.queue.on('receipt', function(receipt) {
      log.debug("msgbroker::queue.onreceipt --> RECEIPT: " + receipt);
    });

    this.queue.on('error', (function(error) {
      log.error('msgbroker::queue.onerror --> We cannot connect to the message broker on ' + queueconf.host + ':' + queueconf.port + ' -- ' + error);
      this.emit('brokerdisconnected');
      this.close();
    }.bind(this)));
  };

  this.close = function() {
    if(this.queue) {
      this.queue.end();
      this.queue = null;
    }
    log.info('msgbroker::close --> Closing connection to msgBroker');
  };

  this.subscribe = function(queueName, callback) {
    this.queue.queue(queueName, function(q) {
      log.debug("msgbroker::subscribe --> Subscribed to queue " + queueName);
      q.bind('#');
      q.subscribe(function (message) {
        callback(message.data);
      });
    });
  };

  /**
   * Insert a new message into the queue
   */
   this.push = function(queueName, body) {
    log.debug('msgbroker::push --> Going to send ' + JSON.stringify(body));
    this.queue.publish(queueName, JSON.stringify(body));
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
