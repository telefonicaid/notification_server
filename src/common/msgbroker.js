/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var amqp = require('amqp'),
    log = require("./logger.js"),
    queueconf = require("../config.js").queue,
    events = require("events"),
    util = require("util");

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
    var self = this;
    this.queue.on('ready', (function() {
      log.info("msgbroker::queue.ready --> Connected to Message Broker");
      //TODO: use Events instead of callbacks here
      self.emit('brokerconnected');
      if (onConnect) {
        return onConnect();
      }
    }));

    this.queue.on('error', (function(error) {
      log.error('msgbroker::queue.onerror --> We cannot connect to the message broker on ' + queueconf.host + ':' + queueconf.port + ' -- ' + error);
      self.emit('brokerdisconnected');
      self.close();
    }));
  };

  this.close = function() {
    if(this.queue) {
      this.queue.end();
      this.queue = null;
    }
    log.info('msgbroker::close --> Closing connection to msgBroker');
  };

  this.subscribe = function(queueName, args, callback) {
    this.queue.queue(queueName, args, function(q) {
      log.info("msgbroker::subscribe --> Subscribed to queue " + queueName);
      q.bind('#');
      q.subscribe(function (message) {
        return callback(message.data);
      });
    });
  };

  /**
   * Insert a new message into the queue
   */
  this.push = function(queueName, body) {
    log.debug('msgbroker::push --> Sending ' + JSON.stringify(body) + ' to the queue ' + queueName);
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
