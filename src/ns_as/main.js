/* jshint node:true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var Log = require('../common/Logger'),
    urlparser = require('url'),
    config = require('../config.js'),
    consts = config.consts,
    fs = require('fs'),
    net = require('net'),
    cluster = require('cluster'),
    MsgBroker = require('../common/MsgBroker'),
    DataStore = require('../common/DataStore'),
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesAS = require('../common/constants').errorcodes.AS,
    Pages = require('../common/Pages.js'),
    Maintenance = require('../common/Maintenance.js'),
    Helpers = require('../common/Helpers.js');

function NS_AS() {
    this.ip = '';
    this.port = 0;
    this.ssl = false;
    this.kSimplePushASFrontendVersionv1 = 'v1';
    this.server = null;
    this.closing = false;
    this.closingCorrectly = false;
    this.dataStoreReady = false;
    this.msgBrokerReady = false;
    this.readyTimeout = undefined;
}

NS_AS.prototype = {

    checkReady: function() {
        if (this.dataStoreReady && this.msgBrokerReady) {
            Log.debug(
                'NS_AS::checkReady --> We are ready. Clearing any readyTimeout'
            );
            clearTimeout(this.readyTimeout);
        } else {
            Log.debug('NS_AS::checkReady --> Not ready yet. dataStoreReady=' +
                this.dataStoreReady +
                ', msgBrokerReady=' + this.msgBrokerReady);
        }
        return this.dataStoreReady && this.msgBrokerReady;
    },

    start: function() {
        Log.info('NS_AS::start()');
        var conf = config.NS_AS.interface;
        this.ip = conf.ip;
        this.port = conf.port;
        this.ssl = conf.ssl;

        if (!net.isIP(this.ip) || isNaN(this.port)) {
            Log.critical('NS_AS::start() --> Bad params, closing');
            this.stop();
            return;
        }

        var closed = 0;
        var errored = false;
        var forked = 0;

        if (cluster.isMaster) {
            // Fork workers.
            for (var i = 0; i < config.NS_AS.numProcesses; i++) {
                cluster.fork();
                forked++;
            }

            cluster.on('exit', function(worker, code) {
                if (code !== 0) {
                    Log.error(Log.messages.ERROR_WORKERERROR, {
                        'id': worker.id,
                        'pid': worker.process.pid,
                        'code': code
                    });
                    if (forked > 20) {
                        Log.critical(
                            'NS_AS::start --> Please, check logs, there has been too much re-spawns'
                        );
                    } else {
                        Log.info('NS_AS::start --> Spawning a new worker…');
                        cluster.fork();
                        forked++;
                        --closed;
                        errored = true;
                    }
                } else {
                    Log.info('NS_AS::start -- wrk' + worker.id +
                        ' with PID ' + worker.process.pid +
                        ' exited correctly');
                }
                ++closed;
                if (closed === config.NS_AS.numProcesses) {
                    if (errored) {
                        Log.error(
                            'NS_AS::start() -- Closing INCORRECTLY. Check errors for a worker'
                        );
                        process.exit(1);
                    } else {
                        Log.info(
                            'NS_AS::start() -- Closing. That\'s all folks!'
                        );
                        process.exit(0);
                    }
                }
            });

        } else {
            var self = this;
            // Create a new HTTP(S) Server
            if (this.ssl) {
                var options = {
                    ca: Helpers.getCaChannel(),
                    key: fs.readFileSync(consts.key),
                    cert: fs.readFileSync(consts.cert),
                    requestCert: false,
                    rejectUnauthorized: false
                };
                this.server = require('https').createServer(options, this.onHTTPMessage
                    .bind(this));
            } else {
                this.server = require('http').createServer(this.onHTTPMessage.bind(
                    this));
            }
            this.server.listen(this.port, this.ip);
            Log.info('NS_AS::start --> HTTP' + (this.ssl ? 'S' : '') +
                ' push AS server starting on ' + this.ip + ':' + this.port);

            // Events from MsgBroker
            MsgBroker.once('ready', function() {
                Log.info('NS_AS::start --> MsgBroker ready and connected');
                self.msgBrokerReady = true;
                self.checkReady();
            });
            MsgBroker.on('closed', function() {
                if (self.closingCorrectly) {
                    Log.info('NS_AS::start --> Closed MsgBroker');
                    return;
                }
                Log.critical(Log.messages.CRITICAL_MBDISCONNECTED, {
                    'class': 'NS_AS',
                    'method': 'start'
                });
                self.msgBrokerReady = false;
                self.stop();
            });

            //Events from DataStore
            DataStore.once('ready', function() {
                Log.info('NS_AS::start --> DataStore ready and connected');
                self.dataStoreReady = true;
                self.checkReady();
            });
            DataStore.on('closed', function() {
                if (self.closingCorrectly) {
                    Log.info('NS_AS::start --> Closed DataStore');
                    return;
                }
                Log.critical(Log.messages.CRITICAL_DBDISCONNECTED, {
                    'class': 'NS_AS',
                    'method': 'start'
                });
                self.dataStoreReady = false;
                self.stop();
            });

            //Wait until we have setup our events listeners
            process.nextTick(function() {
                MsgBroker.start();
                DataStore.start();
            });

            //Check if we are alive
            this.readyTimeout = setTimeout(function() {
                Log.debug('NS_AS::start --> readyTimeout fired');
                if (!self.checkReady()) {
                    Log.critical(Log.messages.CRITICAL_NOTREADY);
                }
            }, 30 * 1000); //Wait 30 seconds
        }
    },

    stop: function(correctly) {
        Log.info('NS_AS::stop() called with correctly=' + correctly);
        if (cluster.isMaster) {
            var timeouts = [];
            Object.keys(cluster.workers).forEach(function(id) {
                timeouts[id] = setTimeout(function() {
                    Log.info('NS_AS::stop --> Killing worker ' + id);
                    cluster.workers[id].destroy();
                }, 4000);
                cluster.workers[id].on('disconnect', function() {
                    Log.info('NS_AS::stop --> Worker ' + id +
                        ' disconnected');
                    clearTimeout(timeouts[id]);
                });
            });
            setTimeout(function() {
                process.exit(1);
            }, 10000);

        } else {
            this.closingCorrectly = correctly;
            Log.info('NS_AS::stop --> Closing NS_AS server');
            clearTimeout(this.readyTimeout);

            //Closing connection with MsgBroker and DataStore
            DataStore.removeAllListeners();
            MsgBroker.removeAllListeners();
            MsgBroker.stop();
            DataStore.stop();

            //Closing connections from the server
            this.server.close();

            setTimeout(function() {
                Log.info('Suiciding worker with id=' + cluster.worker.id +
                    '. Bye!');
                cluster.worker.destroy();
            }, 3000);
        }
    },

    onHTTPMessage: function(request, response) {
        var self = this;

        response.res = function responseHTTP(errorCode) {
            Log.debug('NS_AS::responseHTTP: ', errorCode);
            this.statusCode = errorCode[0];
            this.setHeader('access-control-allow-origin', '*');
            if (consts.PREPRODUCTION_MODE) {
                this.setHeader('Content-Type', 'text/plain');
                if (this.statusCode === 200) {
                    this.write('{"status":"ACCEPTED"}');
                } else {
                    this.write('{"status":"ERROR", "reason":"' + errorCode[1] +
                        '"}');
                }
            }
            this.end();
        };

        if (!self.checkReady()) {
            Log.debug(
                'NS_AS::onHTTPMessage --> Message rejected, we are not ready yet'
            );
            response.res(errorcodes.NOT_READY);
            return;
        }

        Log.debug('NS_AS::onHTTPMessage --> Received request for ' + request.url);
        var url = urlparser.parse(request.url, true);
        var path = url.pathname.split('/');

        // CORS support
        if (request.method === 'OPTIONS') {
            Log.debug('NS_AS::onHTTPMessage --> Received an OPTIONS method');
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.setHeader('Access-Control-Allow-Methods',
                'PUT, GET, OPTIONS');
            response.end();
            return;
        }

        // Frontend for the Mozilla SimplePush API
        if (request.method === 'PUT') {
            Log.debug('NS_AS::onHTTPMessage --> Received a PUT');
            var body = '';
            request.on('data', function(data) {
                body += data;
                // Max. payload: "version=9007199254740992" => lenght: 24
                if (body.length > 25) {
                    request.tooBig = true;
                    request.emit('end');
                    Log.debug(
                        'NS_AS::onHTTPMessage --> Message rejected, too long for this API'
                    );
                    response.res(errorcodesAS.BAD_MESSAGE_BODY_TOO_BIG);
                }
            });
            request.on('end', function() {
                if (request.tooBig) {
                    return;
                }
                self.simplepushRequest(request, body, response);
            });

        } else if (request.method === 'GET') {
            switch (path[1]) {
                case 'about':
                    if (consts.PREPRODUCTION_MODE) {
                        var text = '';
                        try {
                            var p = new Pages();
                            p.setTemplate('views/about.tmpl');
                            text = p.render(function(t) {
                                switch (t) {
                                    case '{{GIT_VERSION}}':
                                        return require('fs').readFileSync(
                                            'version.info');
                                    case '{{MODULE_NAME}}':
                                        return 'Application Server Frontend';
                                    default:
                                        return '';
                                }
                            });
                        } catch (e) {
                            text = 'No version.info file';
                        }
                        response.setHeader('Content-Type', 'text/html');
                        response.statusCode = 200;
                        response.write(text);
                        response.end();
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
                    Log.debug('NS_AS::onHTTPMessage --> messageType "' + path[1] +
                        '" not recognized');
                    response.res(errorcodesAS.BAD_URL);
                    return;
            }

        } else {
            response.statusCode = 400;
            response.end();
        }
    },

    simplepushRequest: function(request, body, response) {
        /**
         * Check if we are closing. If so, send a 500 status
         * to the client. That means: "retry again later"
         */
        if (this.closing) {
            response.end(500);
            return;
        }

        /**
         * Check if the request is correct
         */
        var URI = request.url.split('/');
        var appToken = URI[3];
        var versions = String(body).split('=');
        var version = versions[1] || -1;

        if (URI.length < 3 ||
            URI[1] !== this.kSimplePushASFrontendVersionv1 ||
            URI[2] !== 'notify' || !appToken ||
            versions[0] !== 'version' || !Helpers.isVersion(version)) {
            response.statusCode = 400;
            response.end('{ reason: "Bad request"}');
            Log.info('NS_AS::simplepushRequest --> Bad request ' + body);
            return;
        }

        //Now, we are safe to start using the path and data
        Log.notify(Log.messages.NOTIFY_APPTOKEN_VERSION, {
            appToken: appToken,
            version: version,
            ip: request.connection.remoteAddress || null
        });

        // Send the OK response always, this free some server resources
        response.statusCode = 200;
        //CORS support
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.end('{}');

        //And now we proccess the notification.
        DataStore.getInfoForAppToken(appToken, function(error, appInfo) {
            if (!appInfo || !appInfo.ch || !Array.isArray(appInfo.no)) {
                return;
            }
            (appInfo.no).forEach(function(nodeId) {
                var msg = DataStore.newVersion(nodeId, appToken,
                    appInfo.ch, version);
                MsgBroker.push('newMessages', msg);
            });
        });
    }
};

// Exports
exports.NS_AS = NS_AS;