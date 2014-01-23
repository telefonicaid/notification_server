/* jshint node:true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var Log = require('../common/Logger.js'),
    MsgBroker = require('../common/MsgBroker.js'),
    MobileNetwork = require('../common/MobileNetwork.js'),
    http = require('http'),
    https = require('https'),
    urlparser = require('url');

function NS_UA_UDP() {
    this.closingCorrectly = false;
    this.msgBrokerReady = false;
    this.mobileNetworkReady = false;
    this.readyTimeout = undefined;
}

NS_UA_UDP.prototype = {

    checkReady: function() {
        if (this.msgBrokerReady && this.mobileNetworkReady) {
            Log.debug('NS_UDP::checkReady --> We are ready. Clearing any readyTimeout');
            clearTimeout(this.readyTimeout);
        } else {
            Log.debug('NS_UDP::checkReady --> Not ready yet. msgBrokerReady=' + this.msgBrokerReady + 'mobileNetworkReady=' + this.mobileNetworkReady);
        }
        return this.msgBrokerReady && this.mobileNetworkReady;
    },

    start: function() {

        Log.info('NS_UDP:start --> Starting UA-UDP server');
        var self = this;

        MsgBroker.once('ready', function() {
            Log.info('NS_UDP::start --> MsgBroker ready and connected');
            self.msgBrokerReady = true;
            self.checkReady();
        });

        MsgBroker.on('ready', this.subscribeQueues.bind(this));

        //Hack. Once we have a disconnected queue, we must subscribe again for each
        //broker.
        //This happens on RabbitMQ as follows:
        // 1) We are connected to several brokers
        // 2) We are subscribed to the same queue on those brokers
        // 3) Master fails :(
        // 4) RabbitMQ promotes the eldest slave to be the master
        // 5) RabbitMQ disconnects all clients. Not a socket disconnection, but
        //    unbinds the connection to the subscribed queue.
        //
        // Hacky solution: once we have a disconnected queue (a socket error), we
        // subscribe again to the queue.
        // It's not beautiful (we should really unsubscribe all queues first), but works.
        // This *MIGHT* require OPS job if we have a long-long socket errors with queues.
        // (we might end up with gazillions (hundreds, really) callbacks on the same
        // socket for handling messages)
        MsgBroker.on('queuedisconnected', this.subscribeQueues.bind(this));

        MsgBroker.once('closed', function() {
            self.msgBrokerReady = false;
            if (self.closingCorrectly) {
                Log.info('NS_UDP::stop --> Closed MsgBroker');
                return;
            }
            Log.critical(Log.messages.CRITICAL_MBDISCONNECTED, {
                'class': 'NS_UDP',
                'method': 'start'
            });
            self.stop();
        });

        MobileNetwork.on('ready', function() {
            Log.info('NS_UDP::start --> MobileNetwork is ready');
            self.mobileNetworkReady = true;
            self.checkReady();
        });

        MobileNetwork.once('closed', function() {
            self.mobileNetworkReady = false;
            if (self.closingCorrectly) {
                Log.info('NS_UDP::stop --> Closed MobileNetwork (DataStore)');
                return;
            }
            Log.critical(Log.messages.CRITICAL_DBDISCONNECTED, {
                'class': 'NS_UDP',
                'method': 'start'
            });
            self.stop();
        });

        // Subscribe to the UDP common Queue
        process.nextTick(function() {
            MsgBroker.start();
            MobileNetwork.start();
        });

        //Check if we are alive
        this.readyTimeout = setTimeout(function() {
            if (!self.ready) {
                Log.critical(Log.messages.CRITICAL_NOTREADY);
            }
        }, 30 * 1000); //Wait 30 seconds

    },

    stop: function(correctly) {
        this.closingCorrectly = correctly;
        clearTimeout(this.readyTimeout);
        Log.info('NS_UDP:stop --> Closing UDP server');

        //Closing connection with MsgBroker
        MsgBroker.removeAllListeners();
        MsgBroker.stop();
        setTimeout(function() {
            process.exit(0);
        }, 5000);
    },

    subscribeQueues: function(broker) {
        //We want a durable queue, that do not autodeletes on last closed connection, and
        // with HA activated (mirrored in each rabbit server)
        var args = {
            durable: true,
            autoDelete: false,
            arguments: {
                'x-ha-policy': 'all'
            }
        };
        MsgBroker.subscribe(
            'UDP',
            args,
            broker,
            this.onNewMessage
        );
    },

    onNewMessage: function(message) {
        /**
         * Messages are formed like this:
         * {
         *  "uaid": "<UAID>",
         *  "dt": {
         *    "wakeup_hostport": {
         *      "ip": "IP",
         *      "port": "PORT"
         *    },
         *    "mobilenetwork": {
         *      "mcc": "MCC",
         *      "MobileNetworkc": "MNC"
         *    },
         *    "protocol": "udp|tcp",
         *    "canBeWakeup": "true|false",
         *    "payload": {
         *      "app": "<appToken>",
         *      "ch": "<channelID>",
         *      "vs": "x"
         *    }
         *  }
         * }
         */
        // If message does not follow the above standard, return.
        Log.debug('UDP::queue::onNewMessage --> messageData =', message);
        if (!message.uaid || !message.dt || !message.dt.wakeup_hostport || !message.dt.wakeup_hostport.ip || !message.dt.wakeup_hostport.port || !message.dt.mobilenetwork || !message.dt.mobilenetwork.mcc || !message.dt.mobilenetwork.mnc) {
            Log.error(Log.messages.ERROR_UDPNODATA);
            return;
        }

        MobileNetwork.getNetwork(message.dt.mobilenetwork.mcc, message.dt.mobilenetwork.mnc, function(error, op) {
            if (error) {
                Log.error(Log.messages.ERROR_UDPERRORGETTINGOPERATOR, {
                    'error': error
                });
                return;
            }
            if (!op || !op.wakeup) {
                Log.debug('UDP::queue::onNewMessage --> No WakeUp server found');
                return;
            }
            Log.debug('onNewMessage: UDP WakeUp server for ' + op.operator + ': ' + op.wakeup);

            // Send HTTP Notification Message
            var address = urlparser.parse(op.wakeup);

            if (!address.href) {
                Log.error(Log.messages.ERROR_UDPBADADDRESS, {
                    'address': address
                });
                return;
            }

            var protocolHandler = null;
            switch (address.protocol) {
                case 'http:':
                    protocolHandler = http;
                    break;
                case 'https:':
                    protocolHandler = https;
                    break;
                default:
                    protocolHandler = null;
            }
            if (!protocolHandler) {
                Log.debug('UDP:queue:onNewMessage --> Non valid URL (invalid protocol)');
                return;
            }

            var options = {
                hostname: address.hostname,
                port: address.port,
                path: '/?ip=' + message.dt.wakeup_hostport.ip +
                    '&port=' + message.dt.wakeup_hostport.port +
                    '&proto=' + message.dt.protocol,
                agent: false
            };

            //Fire the request, and forget
            protocolHandler.get(options, function(res) {
                Log.notify(Log.messages.NOTIFY_TO_WAKEUP, {
                    uaid: message.uaid,
                    wakeupip: message.dt.wakeup_hostport.ip,
                    wakeupport: message.dt.wakeup_hostport.port,
                    mcc: message.dt.mobilenetwork.mcc,
                    mnc: message.dt.mobilenetwork.mnc,
                    protocol: message.dt.protocol,
                    response: res.statusCode
                });
            }).on('error', function(e) {
                Log.notify(Log.messages.NOTIFY_TO_WAKEUP, {
                    uaid: message.uaid,
                    wakeupip: message.dt.wakeup_hostport.ip,
                    wakeupport: message.dt.wakeup_hostport.port,
                    mcc: message.dt.mobilenetwork.mcc,
                    mnc: message.dt.mobilenetwork.mnc,
                    protocol: message.dt.protocol,
                    response: e.message
                });
            });
        });
    }
};

exports.NS_UA_UDP = NS_UA_UDP;