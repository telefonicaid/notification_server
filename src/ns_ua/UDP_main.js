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
    Helpers = require('../common/Helpers.js'),
    config = require('../config.js').NS_UA_UDP,
    https = require('https'),
    fs = require('fs'),
    querystring = require('querystring'),
    urlparser = require('url'),
    mn = require('../common/MobileNetwork.js');

function NS_UA_UDP() {
    this.closingCorrectly = false;
    this.msgBrokerReady = false;
    this.mnDatabase = false;
    this.readyTimeout = undefined;
}

NS_UA_UDP.prototype = {

    checkReady: function() {
        if (this.msgBrokerReady && this.mnDatabase) {
            Log.debug(
                'NS_UDP::checkReady --> We are ready. Clearing any readyTimeout'
            );
            clearTimeout(this.readyTimeout);
        } else {
            Log.debug('NS_UDP::checkReady --> Not ready yet. msgBrokerReady=' +
                this.msgBrokerReady + ' / mnDatabase=' + this.mnDatabase);
        }
        return this.msgBrokerReady && this.mnDatabase;
    },

    start: function() {
        Log.info('NS_UDP:start --> Starting UA-UDP server');
        var self = this;

        mn.start();
        mn.once('ready', function() {
            self.mnDatabase = true;
            self.checkReady();
        });

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

        // Subscribe to the UDP common Queue
        process.nextTick(function() {
            MsgBroker.start();
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
        //We want a durable queue, that do not autodeletes on last closed connection
        var args = {
            durable: true,
            autoDelete: false
        };
        MsgBroker.subscribe('UDP', args, broker, this.onNewMessage);
    },

    onNewMessage: function(message) {
        // {
        // "uaid": "<node_id>",
        // "dt": {
        //     "wakeup_hostport": {
        //         "ip": "127.0.0.1",
        //         "port": 44444
        //     },
        //     "mobilenetwork": {
        //         "mcc": "214",
        //         "mnc": "07"
        //     },
        //     "protocol": "udp",
        //     "canBeWakeup": true
        // },
        // "notif": {
        //     "app": "<apptoken>",
        //     "ch": "testApp",
        //     "vs": "1391518019069",
        //     "no": "<node_id>"
        // }

        Log.debug('UDP::queue::onNewMessage --> messageData =', message);

        // If message does not follow the above standard, return.
        var ip = message.dt.wakeup_hostport && message.dt.wakeup_hostport.ip;
        var port = message.dt.wakeup_hostport &&
            message.dt.wakeup_hostport.port;
        var mcc = message.dt.mobilenetwork && message.dt.mobilenetwork.mcc;
        var mnc = message.dt.mobilenetwork && message.dt.mobilenetwork.mnc;
        var protocol = message.dt.protocol || 'udp';
        if (!message.uaid || !ip || !port || !mcc || !mnc) {
            Log.error(Log.messages.ERROR_UDPNODATA);
            return;
        }

        mn.getNetwork(mcc, mnc, function(error, op) {
            if (error) {
                Log.error(Log.messages.ERROR_CONNECTORERRORGETTINGOPERATOR, {
                    'error': error
                });
                return;
            }

            Log.debug('Recovered operator through wakeup: ' + op.wakeup.name);

            // Send HTTP Notification Message
            var address = urlparser.parse(op.wakeup.wakeup);

            if (!address.href) {
                Log.error(Log.messages.ERROR_UDPBADADDRESS, {
                    'address': address
                });
                return;
            }

            if (address.protocol !== 'https:') {
                Log.error(
                    'UDP:queue:onNewMessage --> Request is not HTTPS)'
                );
                return;
            }

            var pathname = address.pathname || '';
            var postData = querystring.stringify({
                ip: ip,
                port: port,
                protocol: message.dt.protocol,
                mcc: mcc,
                mnc: mnc
            });
            var options = {
                hostname: address.hostname,
                port: address.port,
                path: pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': unescape(encodeURIComponent(postData)).length
                },
                ca: op.wakeup.ca,
                key: op.wakeup.key,
                cert: op.wakeup.crt,
                rejectUnauthorized: false,
                agent: false
            };

            var req = https.request(options, function(res) {
                Log.notify(Log.messages.NOTIFY_TO_WAKEUP, {
                    uaid: message.uaid,
                    wakeupip: ip,
                    wakeupport: port,
                    mcc: mcc,
                    mnc: mnc,
                    protocol: protocol,
                    response: res.statusCode,
                    xtracking: res.headers['x-tracking-id']
                });
            });

            req.on('error', function(e) {
                Log.notify(Log.messages.NOTIFY_TO_WAKEUP, {
                    uaid: message.uaid,
                    wakeupip: ip,
                    wakeupport: port,
                    mcc: mcc,
                    mnc: mnc,
                    protocol: protocol,
                    response: e.message
                });
            });

            req.write(postData);
            req.end();
        });
    }
};

exports.NS_UA_UDP = NS_UA_UDP;