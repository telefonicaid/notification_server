/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var Log = require('../common/Logger.js'),
    WebSocketServer = require('websocket').server,
    fs = require('fs'),
    cluster = require('cluster'),
    DataManager = require('./DataManager.js'),
    Token = require('../common/Token.js'),
    Helpers = require('../common/Helpers.js'),
    MsgBroker = require('../common/MsgBroker.js'),
    config = require('../config.js').NS_UA_WS,
    consts = require('../config.js').consts,
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesWS = require('../common/constants').errorcodes.UAWS,
    statuscodes = require('../common/constants').statuscodes,
    Pages = require('../common/Pages.js'),
    url = require('url'),
    http = require('http'),
    https = require('https'),
    Maintenance = require('../common/Maintenance.js');


function NS_UA_WS() {
    this.ip = '';
    this.port = 0;
    this.ssl = false;
    this.dataManagerReady = false;
    this.msgBrokerReady = false;
    this.readyTimeout = null;
    this.stats = {};
    this.stats['max_allowed_connections'] = 1000;
}

NS_UA_WS.prototype.checkReady = function() {
    if (this.dataManagerReady && this.msgBrokerReady) {
        Log.debug('NS_UA_WS::checkReady --> We are ready. Clearing any readyTimeout');
        clearTimeout(this.readyTimeout);
    } else {
        Log.debug('NS_UA_WS::checkReady --> Not ready yet. dataStoreReady=' + this.dataStoreReady +
            ', dataManagerReady=' + this.dataManagerReady);
    }
    return this.dataManagerReady && this.msgBrokerReady;
};

NS_UA_WS.prototype.onStatsRequest = function(request, response) {
    // Broadcast the stats message to all workers
    (function() {
        for (var i in cluster.workers) {
            var worker = cluster.workers[i];
            worker.send({
                cmd: 'stats'
            });
        }
    })();

    // Set a timeout, and hope to have the updated data ;)
    setTimeout((function() {
        response.statusCode = 200;
        response.setHeader('access-control-allow-origin', '*');
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(this.stats));
    }).bind(this), 3000);
};

NS_UA_WS.prototype.mixStatsFromWorkerToGlobal = function(stats, worker) {
    Log.debug('NS_UA_WS::mixStatsFromWorkerToGlobal --> Mixing stats from worker ' + worker);
    for (var s in stats) {
        this.stats[s] = this.stats[s] || [];
        this.stats[s][worker - 1] = stats[s];
    }
};

NS_UA_WS.prototype.start = function() {
    if (!config.interface) {
        Log.critical(Log.messages.CRITICAL_WSINTERFACESNOTCONFIGURED);
        return;
    }

    // Start server
    this.ip = config.interface.ip;
    this.port = config.interface.port;
    this.ssl = config.interface.ssl;
    Log.info('NS_UA_WS::start --> server starting');
    var errored = false;
    var closed = 0;
    var forked = 0;
    var self = this;

    // Strict Mode does not allow to define functions inside if, so here they are
    function messageHandlerMaster(msg) {
        Log.debug('NS_UA_WS::messageHandlerMaster --> Received command ' + msg.cmd + ' from worker ' + msg.worker);
        switch (msg.cmd) {
            case 'stats':
                this.mixStatsFromWorkerToGlobal.bind(this)(msg.value, msg.worker);
                break;
        }
    }

    function messageHandlerWorker(msg) {
        Log.debug('NS_UA_WS::messageHandlerWorker --> Received command ' + msg.cmd);
        switch (msg.cmd) {
            case 'stats':
                process.send({
                    cmd: 'stats',
                    value: this.stats,
                    worker: cluster.worker.id
                });
                break;
            default:
                process.send({
                    cmd: 'unknown'
                });
                break;
        }
    }

    if (cluster.isMaster) {
        // Create the stats server
        if (this.ssl) {
            var options = {
                ca: Helpers.getCaChannel(),
                key: fs.readFileSync(consts.key),
                cert: fs.readFileSync(consts.cert)
            };
            this.server = require('https').createServer(options, this.onStatsRequest.bind(this));
        } else {
            this.server = require('http').createServer(this.onStatsRequest.bind(this));
        }
        this.server.listen((this.port + 222), this.ip);
        Log.info('NS_UA_WS::stats::init --> Stats server running on http' + (this.ssl ? 's' : '') +
            '://' + this.ip + ':' + (this.port + 222) + '/');

        // Fork workers and set messageHandler
        for (var i = 0; i < config.numProcesses; i++) {
            var w = cluster.fork();
            w.on('message', messageHandlerMaster.bind(this));
            forked++;
        }

        cluster.on('exit', (function(worker, code) {
            if (code !== 0) {
                self.stats['unexpected_worker_closed'] = (self.stats['unexpected_worker_closed'] || 0) + 1;
                Log.error(Log.messages.ERROR_WORKERERROR, {
                    'id': worker.id,
                    'pid': worker.process.pid,
                    'code': code
                });
                if (forked > 20) {
                    Log.critical('Please, check logs, there has been too much re-spawns');
                    return;
                }
                if (self.closing) {
                    Log.info('NS_UA_WS::start -- Closing, not spawning anything');
                    return;
                }

                Log.info('NS_UA_WS::start -- Spawning a new worker…');
                --closed;
                var w = cluster.fork();
                w.on('message', messageHandlerMaster.bind(this));
                forked++;
                errored = true;
            } else {
                Log.info('NS_UA_WS::start -- wrk' + worker.id + ' with PID ' + worker.process.pid + ' exited correctly');
            }
            ++closed;
            if (closed === config.numProcesses) {
                if (errored) {
                    Log.error('NS_UA_WS::start() -- Closing INCORRECTLY. Check errors for a worker');
                    process.exit(1);
                } else {
                    Log.info('NS_UA_WS::start() -- Closing. That\'s all folks!');
                    process.exit(0);
                }
            }
        }).bind(this));

    } else {
        // Set message handlers
        process.on('message', messageHandlerWorker.bind(this));

        // Create a new HTTP(S) Server
        if (this.ssl) {
            var options = {
                ca: Helpers.getCaChannel(),
                key: fs.readFileSync(consts.key),
                cert: fs.readFileSync(consts.cert)
            };
            this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
        } else {
            this.server = require('http').createServer(this.onHTTPMessage.bind(this));
        }
        this.server.listen(this.port, this.ip);
        Log.info('NS_UA_WS::server::init --> Running on http' + (this.ssl ? 's' : '') +
            '://' + this.ip + ':' + this.port + '/');

        // Websocket init
        this.wsServer = new WebSocketServer({
            httpServer: this.server,
            keepalive: config.websocket_params.keepalive,
            keepaliveInterval: config.websocket_params.keepaliveInterval,
            maxReceivedMessageSize: config.MAX_MESSAGE_SIZE,
            assembleFragments: true,
            autoAcceptConnections: false // false => Use verify originIsAllowed method
        });
        this.wsServer.on('request', this.onWSRequest.bind(this));

        // Events from MsgBroker
        MsgBroker.once('ready', function() {
            Log.info('NS_UA_WS::start --> MsgBroker ready and connected');
            self.msgBrokerReady = true;
            self.checkReady();
        });

        MsgBroker.on('ready', this.subscribeQueues.bind(this));

        MsgBroker.on('closed', function() {
            if (self.closingCorrectly) {
                Log.info('NS_UA_WS::start --> Closed MsgBroker');
                return;
            }
            Log.critical(Log.messages.CRITICAL_MBDISCONNECTED, {
                'class': 'NS_UA_WS',
                'method': 'start'
            });
            self.msgBrokerReady = false;
            self.stop();
        });

        //Events from DataStore
        DataManager.once('ready', function() {
            Log.info('NS_UA_WS::start --> DataStore ready and connected');
            self.dataManagerReady = true;
            self.checkReady();
        });
        DataManager.on('closed', function() {
            if (self.closingCorrectly) {
                Log.info('NS_UA_WS::start --> Closed DataStore');
                return;
            }
            Log.critical(Log.messages.CRITICAL_DBDISCONNECTED, {
                'class': 'NS_UA_WS',
                'method': 'start'
            });
            self.dataManagerReady = false;
            self.stop();
        });

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

        //Connect to MsgBroker
        process.nextTick(function() {
            MsgBroker.start();
            DataManager.start();
        });

        //Check if we are alive
        this.readyTimeout = setTimeout(function() {
            Log.debug('readyTimeout fired');
            if (!self.checkReady()) {
                Log.critical(Log.messages.CRITICAL_NOTREADY);
            }
        }, 30 * 1000); //Wait 30 seconds
    }

    // Check ulimit
    Helpers.getMaxFileDescriptors(function(error, ulimit) {
        if (error) {
            Log.error(Log.messages.ERROR_ULIMITERROR, {
                'error': error
            });
            return;
        }
        Log.debug('ulimit = ' + ulimit);
        var limit = ulimit - 200;
        if (limit < 10) {
            Log.critical(Log.messages.CRITICAL_WSERRORULIMIT);
        }
        self.stats['max_allowed_connections'] = limit;
    });
};

NS_UA_WS.prototype.stop = function(correctly) {
    this.closing = true;
    if (cluster.isMaster) {
        var timeouts = [];
        Object.keys(cluster.workers).forEach(function(id) {
            cluster.workers[id].send('shutdown');
            timeouts[id] = setTimeout(function() {
                Log.info('NS_UA_WS::stop --> Killing worker ' + id);
                cluster.workers[id].destroy();
            }, 2000);
            cluster.workers[id].on('disconnect', function() {
                Log.info('NS_UA_WS::stop --> Worker ' + id + ' disconnected');
                clearTimeout(timeouts[id]);
            });
        });
    } else {
        this.closingCorrectly = correctly;
        Log.info('NS_UA_WS::stop --> Closing WS server');
        clearTimeout(this.readyTimeout);

        //Closing connection with MsgBroker and DataStore
        DataManager.removeAllListeners();
        MsgBroker.removeAllListeners();
        MsgBroker.stop();
        DataManager.stop();

        //Closing connections from the server
        this.server.close();
        setTimeout(function() {
            Log.info('NS_UA_WS::stop --> Suiciding worker with id=' + cluster.worker.id + '. Bye!');
            cluster.worker.destroy();
        }, 3000);
    }
};

NS_UA_WS.prototype.sendNotification = function(connector, notification) {
    Log.debug('WS::sendNotification --> Sending messages:', notification);
    this.stats['notifications_sent'] = (this.stats['notifications_sent'] || 0) + 1;
    if (!Array.isArray(notification)) {
        notification = [notification];
    }
    connector.notify({
        messageType: 'notification',
        updates: notification
    });
};

NS_UA_WS.prototype.onNewMessage = function(json) {
    this.stats['messages_from_mq'] = (this.stats['messages_from_mq'] || 0) + 1;
    Log.debug('WS::Queue::onNewMessage --> New message received: ', json);
    // If we don't have enough data, return
    if (!json.uaid || !json.payload || !json.payload.ch || !json.payload.vs) {
        Log.error(Log.messages.ERROR_WSNODATA);
        return;
    }
    Log.debug('WS::Queue::onNewMessage --> Notifying node:', json.uaid);
    Log.notify(Log.messages.NOTIFY_MSGSENTTOUA, {
        uaid: json.uaid,
        channelId: json.payload.ch,
        version: json.payload.vs
    });

    var nodeConnector = DataManager.getNodeConnector(json.uaid);
    if (nodeConnector) {
        var notification = {
            version: json.payload.vs,
            channelID: json.payload.ch
        };
        this.sendNotification.bind(this)(nodeConnector, notification);
    } else {
        Log.debug('WS::Queue::onNewMessage --> No node found');
    }
};

NS_UA_WS.prototype.subscribeQueues = function(broker) {
    var args = {
        durable: false,
        autoDelete: true
    };
    MsgBroker.subscribe(process.serverId, args, broker, this.onNewMessage.bind(this));
};

//////////////////////////////////////////////
// HTTP callbacks
//////////////////////////////////////////////
NS_UA_WS.prototype.onHTTPMessage = function(request, response) {
    this.stats['http_requests'] = (this.stats['http_requests'] || 0) + 1;

    response.res = function responseHTTP(errorCode, html) {
        Log.debug('NS_UA_WS::responseHTTP: ', errorCode);
        this.statusCode = errorCode[0];
        this.setHeader('access-control-allow-origin', '*');
        if (html) {
            this.setHeader('Content-Type', 'text/html');
            this.write(html);
        } else {
            if (consts.PREPRODUCTION_MODE) {
                this.setHeader('Content-Type', 'text/plain');
                if (this.statusCode === 200) {
                    this.write('{"status":"ACCEPTED"}');
                } else {
                    this.write('{"status":"ERROR", "reason":"' + errorCode[1] + '"}');
                }
            }
        }
        return this.end();
    };

    var text = null;
    if (!this.checkReady()) {
        Log.info('WS:onHTTPMessage --> Request received but not ready yet');
        response.res(errorcodes.NOT_READY);
        return;
    }

    Log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
    var url = this.parseURL(request.url);

    Log.debug('WS::onHTTPMessage --> Parsed URL:', url);
    switch (url.messageType) {
        case 'about':
            if (consts.PREPRODUCTION_MODE) {
                try {
                    var p = new Pages();
                    p.setTemplate('views/aboutWS.tmpl');
                    text = p.render((function(t) {
                        switch (t) {
                            case '{{GIT_VERSION}}':
                                return require('fs').readFileSync('version.info');
                            case '{{MODULE_NAME}}':
                                return 'User Agent Frontend';
                            case '{{PARAM_TOKENSGENERATED}}':
                                return this.stats['tokens_generated'];
                            case '{{PARAM_CONNECTIONS}}':
                                return this.stats['websocket_actual_open_connections'];
                            case '{{PARAM_MAXCONNECTIONS}}':
                                return this.stats['max_allowed_connections'];
                            case '{{PARAM_NUMPROCESSES}}':
                                return config.numProcesses;
                            default:
                                return '';
                        }
                    }).bind(this));
                } catch (e) {
                    text = 'No version.info file';
                }
                response.res(errorcodes.NO_ERROR, text);
                return;
            } else {
                response.res(errorcodes.NOT_ALLOWED_ON_PRODUCTION_SYSTEM);
                return;
            }
            break;

        case 'status':
            // Return status mode to be used by load-balancers
            response.setHeader('Content-Type', 'text/html');
            if (Maintenance.getStatus()) {
                response.statusCode = 503;
                response.write('Under Maintenance');
            } else {
                response.statusCode = 200;
                response.write('OK');
            }
            response.end();
            break;

        default:
            Log.debug('WS::onHTTPMessage --> messageType not recognized');
            response.res(errorcodesWS.BAD_MESSAGE_NOT_RECOGNIZED);
            return;
    }
};

//////////////////////////////////////////////
// WebSocket callbacks
//////////////////////////////////////////////
NS_UA_WS.prototype.onWSRequest = function(request) {

    // Common variables
    var self = this;

    ///////////////////////
    // WS Callbacks
    ///////////////////////
    this.onWSMessage = function(message) {
        self.stats['websocket_messages'] = (self.stats['websocket_messages'] || 0) + 1;

        // Restart autoclosing timeout
        var nodeConnector = DataManager.getNodeConnector(connection.uaid);
        if (nodeConnector) {
            nodeConnector.resetAutoclose();
        }

        if (message.type === 'utf8') {
            Log.debug('WS::onWSMessage --> Received Message: ' + message.utf8Data);
            var query = {};
            try {
                query = JSON.parse(message.utf8Data);
            } catch (e) {
                Log.debug('WS::onWSMessage --> Data received is not a valid JSON package');
                connection.res({
                    errorcode: errorcodesWS.NOT_VALID_JSON_PACKAGE
                });
                connection.close();
                return;
            }

            //Check for uaid in the connection
            if (!connection.uaid && query.messageType !== 'hello') {
                Log.debug('WS:onWSMessage --> No uaid for this connection');
                connection.res({
                    errorcode: errorcodesWS.UAID_NOT_FOUND,
                    extradata: {
                        messageType: query.messageType
                    }
                });
                connection.close();
                return;
            }

            // If we have a uaid for this connection, ignore this message
            if (connection.uaid && query.messageType === 'hello') {
                Log.debug('WS:onWSMessage --> New hello message on a hello\'ed ' +
                    'connection is discarded');
                return;
            }

            switch (query.messageType) {
                case undefined:
                    Log.debug('WS::onWSMessage --> PING package');

                    // Send the ping...
                    connection.sendUTF('{}');
                    self.stats['websocket_messages_ping'] = (self.stats['websocket_messages_ping'] || 0) + 1;

                    // And check if there is any notification pending
                    process.nextTick(function() {
                        self.getPendingMessages(connection.uaid, function(channelsUpdate) {
                            if (channelsUpdate) {
                                self.sendNotification(nodeConnector, channelsUpdate).bind(self);
                            }
                        });
                    });
                    break;

                case 'hello':
                    if (!query.uaid || !Token.verify(query.uaid)) {
                        query.uaid = Token.get();
                        query.channelIDs = null;
                        self.stats['tokens_generated'] = (self.stats['tokens_generated'] || 0) + 1;
                    }
                    Log.debug('WS:onWSMessage --> Accepted uaid=' + query.uaid);
                    connection.uaid = query.uaid;

                    //KPI: 0x2000
                    Log.notify(Log.messages.NOTIFY_HELLO, {
                        uaid: connection.uaid,
                        socket_ip: connection.remoteAddress,
                        socket_port: connection.socket.remotePort,
                        ip: (query.wakeup_hostport && query.wakeup_hostport.ip) || 0,
                        port: (query.wakeup_hostport && query.wakeup_hostport.port) || 0,
                        mcc: (query.mobilenetwork && query.mobilenetwork.mcc) || 0,
                        mnc: (query.mobilenetwork && query.mobilenetwork.mnc) || 0
                    });
                    self.stats['websocket_messages_hello'] = (self.stats['websocket_messages_hello'] || 0) + 1;

                    // New UA registration
                    Log.debug('WS::onWSMessage --> HELLO - UA registration message');
                    //query parameters are validated while getting the connector in
                    // connectors/Connector.js
                    DataManager.registerNode(query, connection, function onNodeRegistered(error, res, data) {
                        if (error) {
                            connection.res({
                                errorcode: errorcodesWS.FAILED_REGISTERUA,
                                extradata: {
                                    messageType: 'hello'
                                }
                            });
                            Log.debug('WS::onWSMessage --> Failing registering UA');
                            connection.close();
                            return;
                        }
                        connection.res({
                            errorcode: errorcodes.NO_ERROR,
                            extradata: {
                                messageType: 'hello',
                                uaid: query.uaid,
                                status: (data.canBeWakeup ? statuscodes.UDPREGISTERED : statuscodes.REGISTERED)
                            }
                        });

                        // If uaid do not have any channelIDs (first connection), we do not launch this processes.
                        if (query.channelIDs && Array.isArray(query.channelIDs)) {
                            //Start recovery protocol
                            process.nextTick(function() {
                                self.recoveryChannels(connection.uaid, query.channelIDs, connection);
                            });

                            // And check if there is any notification pending
                            process.nextTick(function() {
                                self.getPendingMessages(connection.uaid, function(channelsUpdate) {
                                    if (channelsUpdate) {
                                        self.sendNotification(nodeConnector, channelsUpdate).bind(self);
                                    }
                                });
                            });
                        }
                        Log.debug('WS::onWSMessage --> OK register UA');
                    });
                    break;

                case 'register':
                    Log.debug('WS::onWSMessage::register --> Application registration message');
                    self.stats['websocket_messages_register'] = (self.stats['websocket_messages_register'] || 0) + 1;

                    // Close the connection if the channelID is null
                    var channelID = query.channelID;
                    if (!channelID || typeof(channelID) !== 'string') {
                        Log.debug('WS::onWSMessage::register --> Null channelID');
                        connection.res({
                            errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                            extradata: {
                                messageType: 'register'
                            }
                        });
                        //There must be a problem on the client, because channelID is the way to identify an app
                        //Close in this case.
                        connection.close();
                        return;
                    }

                    // Register and store in database
                    Log.debug('WS::onWSMessage::register uaid: ' + connection.uaid);
                    var appToken = Helpers.getAppToken(channelID, connection.uaid);

                    //KPI: 0x2001
                    Log.notify(Log.messages.NOTIFY_REGISTER, {
                        uaid: connection.uaid,
                        channelID: channelID,
                        appToken: appToken
                    });

                    DataManager.registerApplication(appToken, channelID, connection.uaid, function(error) {
                        if (!error) {
                            var notifyURL = Helpers.getNotificationURL(appToken);
                            connection.res({
                                errorcode: errorcodes.NO_ERROR,
                                extradata: {
                                    messageType: 'register',
                                    status: statuscodes.REGISTERED,
                                    pushEndpoint: notifyURL,
                                    'channelID': channelID
                                }
                            });
                            Log.debug('WS::onWSMessage::register --> OK registering channelID');
                        } else {
                            connection.res({
                                errorcode: errorcodes.NOT_READY,
                                extradata: {
                                    'channelID': channelID,
                                    messageType: 'register'
                                }
                            });
                            Log.debug('WS::onWSMessage::register --> Failing registering channelID');
                        }
                    });
                    break;

                case 'unregister':
                    self.stats['websocket_messages_unregister'] = (self.stats['websocket_messages_unregister'] || 0) + 1;

                    // Close the connection if the channelID is null
                    channelID = query.channelID;

                    Log.debug('WS::onWSMessage::unregister --> Application un-registration message for ' + channelID);
                    if (!channelID || typeof(channelID) !== 'string') {
                        Log.debug('WS::onWSMessage::unregister --> Null channelID');
                        connection.res({
                            errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                            extradata: {
                                messageType: 'unregister'
                            }
                        });
                        //There must be a problem on the client, because channelID is the way to identify an app
                        //Close in this case.
                        connection.close();
                        return;
                    }

                    appToken = Helpers.getAppToken(query.channelID, connection.uaid);

                    //KPI: 0x2002
                    Log.notify(Log.messages.NOTIFY_UNREGISTER, {
                        uaid: connection.uaid,
                        channelID: channelID,
                        appToken: appToken
                    });

                    DataManager.unregisterApplication(appToken, connection.uaid, function(error) {
                        if (!error) {
                            connection.res({
                                errorcode: errorcodes.NO_ERROR,
                                extradata: {
                                    channelID: query.channelID,
                                    messageType: 'unregister',
                                    status: statuscodes.UNREGISTERED
                                }
                            });
                            Log.debug('WS::onWSMessage::unregister --> OK unregistering channelID');
                        } else {
                            if (error === -1) {
                                connection.res({
                                    errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                                    extradata: {
                                        messageType: 'unregister'
                                    }
                                });
                            } else {
                                connection.res({
                                    errorcode: errorcodes.NOT_READY,
                                    extradata: {
                                        messageType: 'unregister'
                                    }
                                });
                            }
                            Log.debug('WS::onWSMessage::unregister --> Failing unregistering channelID');
                        }
                    });
                    break;

                case 'ack':
                    self.stats['websocket_messages_ack'] = (self.stats['websocket_messages_ack'] || 0) + 1;

                    if (!Array.isArray(query.updates)) {
                        connection.res({
                            errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                            extradata: {
                                messageType: 'ack'
                            }
                        });
                        connection.close();
                        return;
                    }

                    query.updates.forEach(function(el) {
                        if (!el.channelID || typeof el.channelID !== 'string' || !Helpers.isVersion(el.version)) {
                            connection.res({
                                errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                                extradata: {
                                    messageType: 'ack',
                                    channelID: el.channelID,
                                    version: el.version
                                }
                            });
                            return;
                        }

                        Log.notify(Log.messages.NOTIFY_ACK, {
                            uaid: connection.uaid,
                            channelID: el.channelID,
                            appToken: Helpers.getAppToken(el.channelID, connection.uaid),
                            version: el.version
                        });

                        DataManager.ackMessage(connection.uaid, el.channelID, el.version);
                    });
                    break;

                default:
                    self.stats['websocket_messages_unknown'] = (self.stats['websocket_messages_unknown'] || 0) + 1;

                    Log.debug('WS::onWSMessage::default --> messageType not recognized');
                    connection.res({
                        errorcode: errorcodesWS.MESSAGETYPE_NOT_RECOGNIZED
                    });
                    connection.close();
                    return;
            }
        } else if (message.type === 'binary') {

            self.stats['websocket_messages_binary'] = (self.stats['websocket_messages_binary'] || 0) + 1;

            // No binary data supported yet
            Log.debug('WS::onWSMessage --> Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.res({
                errorcode: errorcodesWS.BINARY_MSG_NOT_SUPPORTED
            });
            connection.close();
        }
    };

    this.onWSClose = function(reasonCode, description) {
        self.stats['websocket_closed_connections'] = (self.stats['websocket_closed_connections'] || 0) + 1;
        self.stats['websocket_actual_open_connections'] = self.stats['websocket_actual_open_connections'] - 1;
        DataManager.unregisterNode(connection.uaid);
        Log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected with uaid ' + connection.uaid);
    };

    /**
     * Verify origin in order to accept or reject connections
     */
    this.originIsAllowed = function(origin) {
        // TODO: put Logic here to detect whether the specified origin is allowed. Issue #64
        return true;
    };

    ///////////////////////
    // Websocket creation
    ///////////////////////

    // Check limits
    if (self.wsConnections >= self.stats['max_allowed_connections']) {
        Log.debug('WS::onWSRequest --> Connection unaccepted. To many open connections');
        request.reject();
        return;
    }

    // Abuse controls
    if (!this.originIsAllowed(request.origin)) {
        // Make sure we only accept requests from an allowed origin
        Log.debug('WS::onWSRequest --> Connection from origin ' + request.origin + ' rejected.');
        request.reject();
        return;
    }

    if (!self.checkReady()) {
        Log.debug('WS::onWSRequest --> We are not ready yet. Rejecting.');
        request.reject();
        return;
    }

    // Connection accepted
    try {
        var connection = request.accept('push-notification', request.origin);
        this.stats['websocket_total_opened_connections'] = (this.stats['websocket_total_opened_connections'] || 0) + 1;
        this.stats['websocket_actual_open_connections'] = (this.stats['websocket_actual_open_connections'] || 0) + 1;

        Log.debug('WS::onWSRequest --> Connection accepted.');
        connection.on('message', this.onWSMessage);
        connection.on('close', this.onWSClose);
        connection.res = function responseWS(payload) {
            Log.debug('WS::responseWS:', payload);
            var res = {};
            if (payload && payload.extradata) {
                res = payload.extradata;
            }
            if (payload && payload.errorcode[0] > 299) { // Out of the 2xx series
                if (!res.status) {
                    res.status = payload.errorcode[0];
                }
                res.reason = payload.errorcode[1];
            }
            connection.sendUTF(JSON.stringify(res));
        };
    } catch (e) {
        Log.debug('WS::onWSRequest --> Connection from origin ' + request.origin + 'rejected. Bad WebSocket sub-protocol.');
        request.reject();
    }
};

///////////////////////
// Auxiliar methods
///////////////////////
NS_UA_WS.prototype.parseURL = function(url) {
    // TODO: Review Logic of this method. Issue #65
    var urlparser = require('url');
    var data = {};
    data.parsedURL = urlparser.parse(url, true);
    var path = data.parsedURL.pathname.split('/');
    data.messageType = path[1];
    if (path.length > 2) {
        data.Token = path[2];
    } else {
        data.Token = data.parsedURL.query.Token;
    }
    return data;
};

NS_UA_WS.prototype.getPendingMessages = function(uaid, callback) {
    callback = Helpers.checkCallback(callback);
    Log.debug('WS::onWSMessage::getPendingMessages --> Sending pending notifications');
    DataManager.getNodeData(uaid, function(err, data) {
        if (err) {
            Log.error(Log.messages.ERROR_WSERRORGETTINGNODE);
            callback(null);
            return;
        }
        // In this case, there are no channels for this
        if (!data || !data.ch || !Array.isArray(data.ch)) {
            Log.debug(Log.messages.ERROR_WSNOCHANNELS);
            callback(null);
            return;
        }
        var channelsUpdate = [];
        data.ch.forEach(function(channel) {
            if (Helpers.isVersion(channel.vs) && channel.new) {
                channelsUpdate.push({
                    channelID: channel.ch,
                    version: channel.vs
                });
            }
        });
        if (channelsUpdate.length > 0) {
            callback(channelsUpdate);
            return;
        }

        //No channelsUpdate (no new)
        callback(null);
    });
};

NS_UA_WS.prototype.recoveryChannels = function(uaid, channelIDs, connection) {
    Log.debug('WS::onWSMessage::recoveryChannels --> ' +
        'Recovery channels process for UAID=' + uaid +
        ', channelsIDs=', channelIDs);
    DataManager.getApplicationsForUA(uaid, function(error, channels) {
        Log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
            ', recoveredchannels=' + JSON.stringify(channels));
        if (error) {
            return;
        }
        channels.forEach(function(ch) {
            //Already registered
            Log.debug('WS::onWSMessage::recoveryChannels --> Checking server channel=' +
                JSON.stringify(ch.ch));
            if (channelIDs.indexOf(ch.ch) > -1) {
                Log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                    ', had previously registered=' + ch.ch);
            } else {
                // Need to unregister (not in send)
                Log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                    ', to unregister=' + ch.ch);
                var appToken = Helpers.getAppToken(ch.ch, uaid);
                DataManager.unregisterApplication(appToken, uaid);
                return;
            }

            // Splicing the Array, so we end up with the old array with
            // just new registrations
            var index = channelIDs.indexOf(ch.ch);
            if (index > -1) {
                channelIDs.splice(index, 1);
            }
        });

        //Register the spliced channelIDs
        Log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
            ', to register unregistered=' + channelIDs);
        channelIDs.forEach(function(ch) {
            Log.debug('WS::onWSMessage::recoveryChannels --> UAID=' + uaid +
                ', to register=' + ch);
            var appToken = Helpers.getAppToken(ch, uaid);
            DataManager.registerApplication(appToken, ch, uaid, function(error) {
                if (error) {
                    Log.debug('WS::onWSMessage::recoveryChannels --> Failing registering channelID');
                    return;
                }
                var notifyURL = Helpers.getNotificationURL(appToken);
                Log.debug('WS::onWSMessage::recoveryChannels --> OK registering channelID: ' + notifyURL);
                if (connection) {
                    connection.res({
                        errorcode: errorcodes.NO_ERROR,
                        extradata: {
                            messageType: 'register',
                            status: statuscodes.REGISTERED,
                            pushEndpoint: notifyURL,
                            channelID: channelID
                        }
                    });
                }
            });
        });
    });
};

exports.NS_UA_WS = NS_UA_WS;