/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var amqp = require('amqp'),
    log = require("./logger.js"),
    queuesConf = require("../config.js").queue,
    events = require("events"),
    util = require("util");

var gControlledClose = false;

var MsgBroker = function() {
  events.EventEmitter.call(this);
  this.queues = [];

  this.init = function() {
    log.info('msgBroker::queue.init --> Connecting to the queue servers');

    //Create connection to the broker
    if (!Array.isArray(queuesConf)) queuesConf = [queuesConf];
    for (var i = queuesConf.length - 1; i >= 0; i--) {
      process.nextTick(this.createConnection.bind(this, i));
    }
  };

  // Get some events love
  this.on('queueconnected', (function() {
    log.debug('msgBroker::queueconnected --> New queue connected, we have ' + this.queues.length + ' connections opened');
    if (this.queues.length === 1) {
      this.emit('brokerconnected');
    }
  }).bind(this));

  this.on('queuedisconnected', (function() {
    log.debug('msgBroker::queuedisconnected --> Queue disconnected, we have  ' + this.queues.length + ' connections opened');
    if (!this.queues.length) {
      if (!gControlledClose) this.emit('brokerdisconnected');
      this.close();
    }
  }).bind(this));

  this.close = function(controlled) {
    gControlledClose = true;
    this.queues.forEach(function(element) {
      if (element.queue) {
        element.end();
      }
    });
    log.info('msgbroker::close --> Closing connection to msgBroker');
  };

  this.subscribe = function(queueName, args, callback) {
    this.queues.forEach(function(connection) {
      if (!connection) return;
      var conn = connection;
      conn.queue(queueName, args, function(q) {
        log.info("msgbroker::subscribe --> Subscribed to queue: " + queueName);
        q.bind('#');
        q.subscribe(function (message) {
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
      if(connection && !sent) {
        connection.publish(queueName, JSON.stringify(body));
        sent = true;
      }
    });
  };

  this.createConnection = function(i) {
    var conn = amqp.createConnection({
      port: queuesConf[i].port,
      host: queuesConf[i].host,
      login: queuesConf[i].login,
      password: queuesConf[i].password
    });

    // Events for this queue
    conn.on('ready', (function() {
      log.info("msgbroker::queue.ready --> Connected to one Message Broker");
      this.queues.push(conn);
      this.emit('queueconnected');
    }).bind(this));

    conn.on('close', (function() {
      if (!gControlledClose) {
        this.emit('queuedisconnected');
        log.error('msgbroker::queue --> one message broker disconnected!!!');
      }
      var index = this.queues.indexOf(conn);
      if (index >= 0) {
        this.queues.splice(index, 1);
      }
    }).bind(this));

    conn.on('error', (function(error) {
      log.error('msgbroker::queue.onerror --> There was an error in one of the connections: ' + error);
      var index = this.queues.indexOf(conn);
      if (index >= 0) {
        this.queues.splice(index, 1);
      }
    }).bind(this));
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
