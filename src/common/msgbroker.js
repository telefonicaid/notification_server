/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var amqp = require('amqp'),
    log = require('./logger.js'),
    queuesConf = require('../config.js').queue,
    events = require('events'),
    util = require('util');

var gControlledClose = false;

// Constants
var QUEUE_DISCONNECTED = 0;
var QUEUE_CREATED = 1;
var QUEUE_ERROR = 2;
var QUEUE_CONNECTED = 3;

var MsgBroker = function() {
  events.EventEmitter.call(this);
  this.queues = [];
  this.conns = [];
  var self = this;

  this.init = function() {
    log.info('msgBroker::queue.init --> Connecting to the queue servers');

    //Create connection to the broker
    if (!Array.isArray(queuesConf)) {
      queuesConf = [queuesConf];
    };

    for (var i = queuesConf.length - 1; i >= 0; i--) {
      self.createConnection(queuesConf[i]);
    }
  };

  this.close = function(controlled) {
    gControlledClose = true;
    this.queues.forEach(function(element) {
      if (element.queue) {
        element.end();
      }
    });
    log.info('msgbroker::close --> Closing connection to msgBroker');
  };

  this.subscribe = function(queueName, args, broker, callback) {
    if (broker && !Array.isArray(broker)) {
      broker = [broker];
    } else {
      broker = this.queues;
    }
    broker.forEach(function(broker) {
      broker.queue(queueName, args, function(q) {
        log.info('msgbroker::subscribe --> Subscribed to queue: ' + queueName);
        q.bind('#');
        q.subscribe(function(message) {
          return callback(message.data);
        });
      });
    });
  };

  /**
   * Insert a new message into the queue
   */
  this.push = function(queueName, body) {
    log.debug('msgbroker::push --> Sending to the queue ' + queueName + ' the package:', body);
    //Send to one of the connections that is connected to a queue
    //TODO: send randomly , not to the first open connection (which is the easiest 'algorithm')
    var sent = false;
    this.queues.forEach(function(connection) {
      if (connection && !sent) {
        connection.publish(queueName, JSON.stringify(body));
        sent = true;
      }
    });
  };

  this.createConnection = function(queuesConf) {
    var conn = amqp.createConnection({
      port: queuesConf.port,
      host: queuesConf.host,
      login: queuesConf.login,
      password: queuesConf.password,
      heartbeat: queuesConf.heartbeat
    },
    {
      reconnect: true,
      reconnectBackoffStrategy: 'exponential'
    });
    conn.state = QUEUE_CREATED;
    conn.id = Math.random();
    this.conns.push(conn);

    // Events for this queue
    conn.on('ready', (function() {
      conn.state = QUEUE_CONNECTED;
      log.info("msgbroker::queue.ready --> Connected to one Message Broker, id=" + conn.id);
      self.queues.push(conn);
      self.emit('brokerconnected', conn);
    }));

    conn.on('close', (function() {
      var index = self.queues.indexOf(conn);
      if (index >= 0) {
        self.queues.splice(index, 1);
      }
      var length = self.queues.length;
      var allDisconnected = self.conns.every(self.isDisconnected);
      var pending = self.conns.some(self.pending);
      if (length === 0 && allDisconnected && !pending) {
        if (!gControlledClose) {
          self.emit('brokerdisconnected');
        }
        self.close();
      }
      if (conn.state === QUEUE_CONNECTED) {
        conn.state = QUEUE_DISCONNECTED;
      }
    }));

    conn.on('error', (function(error) {
      log.error(log.messages.ERROR_MBCONNECTIONERROR, {
        "error": error
      });
      conn.state = QUEUE_ERROR;
      self.emit('queuedisconnected', conn);
    }));

    conn.on('heartbeat', (function() {
      log.debug('msgbroker::heartbeat');
    }));
  };

  this.isDisconnected = function(element) {
    return element.state === QUEUE_DISCONNECTED;
  };

  this.pending = function(element) {
    return element.state === QUEUE_CREATED;
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
