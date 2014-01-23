/* jshint node:true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';

var amqp = require('amqp'),
    Log = require('./Logger.js'),
    queuesConf = require('../config.js').queue,
    events = require('events'),
    util = require('util');


// Constants
var QUEUE_DISCONNECTED = 0;
var QUEUE_CREATED = 1;
var QUEUE_ERROR = 2;
var QUEUE_CONNECTED = 3;

function MsgBroker() {
    events.EventEmitter.call(this);
    this.queues = [];
    this.conns = [];
    this.exchangeNames = {};
    this.controlledClose = false;
}

util.inherits(MsgBroker, events.EventEmitter);

MsgBroker.prototype.start = function() {
    Log.info('msgBroker::queue.init --> Connecting to the queue servers');

    //Create connection to the broker
    if (!Array.isArray(queuesConf)) {
        queuesConf = [queuesConf];
    }

    for (var i = queuesConf.length - 1; i >= 0; i--) {
        this.createConnection(queuesConf[i]);
    }
};

MsgBroker.prototype.stop = function() {
    this.controlledClose = true;
    this.queues.forEach(function(element) {
        if (element.queue) {
            element.end();
        }
    });
    Log.info('msgbroker::close --> Closing connection to msgBroker');
};

MsgBroker.prototype.subscribe = function(queueName, args, broker, callback) {
    if (this.controlledClose) {
        return;
    }
    if (broker && !Array.isArray(broker)) {
        broker = [broker];
    } else {
        broker = this.queues;
    }
    broker = broker.filter(function(conn) {
        return conn.state === QUEUE_CONNECTED;
    });

    broker.forEach(function(br) {
        var exchange = br.exchange(queueName + '-fanout', {
            type: 'fanout'
        });

        var q = br.queue(queueName, args, function() {
            Log.info('msgbroker::subscribe --> Subscribed to queue: ' + queueName);
            q.bind(exchange, '*');
            q.subscribe(callback);
        });
    });
};

/**
 * Insert a new message into the queue
 */
MsgBroker.prototype.push = function(queueName, obj) {
    Log.debug('msgbroker::push --> Sending to the queue ' + queueName + ' the package:', obj);
    var i = this.queues.length;
    var exchangeName = queueName + '-fanout';
    /**
     * We need to create an exchange for each of the queues where we need
     * to push. Remember that a SINGLE exchange is not possible since we can push
     * to two different queues (UDP and WS1, for example)
     */
    while (!this.exchangeNames[exchangeName] && i > 0) {
        if (this.queues[i - 1]) {
            this.exchangeNames[exchangeName] = this.queues[i - 1].exchange(queueName + '-fanout', {
                type: 'fanout'
            });
        }
        i--;
    }
    this.exchangeNames[exchangeName].publish(queueName, obj, {
        contentType: 'application/json',
        deliveryMode: 1
    });
};

MsgBroker.prototype.createConnection = function(queuesConf) {
    var conn = new amqp.createConnection({
        port: queuesConf.port,
        host: queuesConf.host,
        Login: queuesConf.Login,
        password: queuesConf.password,
        heartbeat: queuesConf.heartbeat
    }, {
        reconnect: true,
        reconnectBackoffStrategy: 'exponential'
    });
    conn.state = QUEUE_CREATED;
    conn.id = Math.random();
    this.conns.push(conn);

    var self = this;

    // Events for this queue
    conn.on('ready', (function() {
        conn.state = QUEUE_CONNECTED;
        Log.info('msgbroker::queue.ready --> Connected to one Message Broker, id=' + conn.id);
        self.queues.push(conn);
        self.emit('ready', conn);
    }));

    conn.on('close', (function() {
        Log.info('msgbroker::queue.close --> Close on one Message Broker, id=' + conn.id);
        if (conn.state === QUEUE_CONNECTED) {
            conn.state = QUEUE_DISCONNECTED;
        }
        var index = self.queues.indexOf(conn);
        if (index >= 0) {
            self.queues.splice(index, 1);
        }
        var length = self.queues.length;
        var allDisconnected = self.conns.every(self.isDisconnected);
        var pending = self.conns.some(self.pending);
        if (length === 0 && allDisconnected && !pending) {
            if (!self.controlledClose) {
                self.emit('closed');
            }
            self.stop();
        }
        self.emit('queuedisconnected');
    }));

    conn.on('error', (function(error) {
        Log.error(Log.messages.ERROR_MBCONNECTIONERROR, {
            'error': error.type
        });
        conn.state = QUEUE_ERROR;
        self.emit('queuedisconnected');
        self.exchange = undefined;
    }));

    conn.on('heartbeat', (function() {
        Log.debug('msgbroker::heartbeat');
    }));
};

MsgBroker.prototype.isDisconnected = function(element) {
    return element.state !== QUEUE_CONNECTED;
};

MsgBroker.prototype.pending = function(element) {
    return element.state === QUEUE_CREATED;
};

var _msg = new MsgBroker();

function getMsgBroker() {
    return _msg;
}

module.exports = getMsgBroker();