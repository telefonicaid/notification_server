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

var MsgBroker = function() {
  events.EventEmitter.call(this);
  var self = this;

  this.init = function() {
    log.info('msgBroker::queue.init --> Connecting to the queue servers');

    //Create connection to the broker
    self.queues = [];
    if (!Array.isArray(queuesConf)) queuesConf = [queuesConf];
    for (var i = queuesConf.length - 1; i >= 0; i--) {
      setTimeout(self.createConnection, 5*i, /*parameter*/ i);
    }
  };

  // Get some events love
  this.on('queueconnected', function() {
    log.debug('msgBroker::queueconnected --> New queue connected, we have ' + self.queues.length + ' connections opened');
    if (self.queues.length === 1) {
      self.emit('brokerconnected');
    }
  });

  this.on('queuedisconnected', function() {
    log.debug('msgBroker::queuedisconnected --> Queue disconnected, we have  ' + self.queues.length + ' connections opened');
    if (!self.queues.length) {
      self.emit('brokerdisconnected');
      self.close();
    }
  });

  this.close = function() {
    for (var i = self.queues.length - 1; i >= 0; i--) {
      if (self.queues[i].queue) self.queues[i].end();
      delete self.queues[i];
    }
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
      self.queues.push(conn);
      self.emit('queueconnected');
    }));

    conn.on('close', (function() {
      log.error('msgbroker::queue --> one message broker disconnected!!!');
      self.emit('queuedisconnected');
      var index = self.queues.indexOf(conn);
      if (index >= 0) {
        self.queues.splice(index, 1);
      }
    }));

    conn.on('error', (function(error) {
      log.error('msgbroker::queue.onerror --> There was an error in one of the connections: ' + error);
      var index = self.queues.indexOf(conn);
      if (index >= 0) {
        self.queues.splice(index, 1);
      }
    }));
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
