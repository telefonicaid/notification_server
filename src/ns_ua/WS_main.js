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
  this.TokensGenerated = 0;
  this.wsConnections = 0;
  this.wsMaxConnections = 1000;
  this.readyTimeout = null;
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

  if (cluster.isMaster) {
    // Fork workers.
    for (var i = 0; i < config.numProcesses; i++) {
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
          Log.critical('Please, check logs, there has been too much re-spawns');
          return;
        } else {
          Log.info('NS_UA_WS::start -- Spawning a new worker…');
          --closed;
          cluster.fork();
          forked++
          errored = true;
        }
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
    });

  } else {
    // Create a new HTTP(S) Server
    if (this.ssl) {
      var options = {
        ca: Helpers.getCaChannel(),
        key: fs.readFileSync(consts.key),
        cert: fs.readFileSync(consts.cert)
      };
      this.server = require('https').createServer(options, this.onHTTPMessage);
    } else {
      this.server = require('http').createServer(this.onHTTPMessage);
    }
    this.server.listen(this.port, this.ip);
    Log.info('NS_UA_WS::server::init --> HTTP' + (this.ssl ? 'S' : '') +
             ' push UA_WS server running on ' + this.ip + ':' + this.port);

    // Websocket init
    this.wsServer = new WebSocketServer({
      httpServer: this.server,
      keepalive: config.websocket_params.keepalive,
      keepaliveInterval: config.websocket_params.keepaliveInterval,
      dropConnectionOnKeepaliveTimeout: config.websocket_params.dropConnectionOnKeepaliveTimeout,
      keepaliveGracePeriod: config.websocket_params.keepaliveGracePeriod,
      maxReceivedMessageSize: config.websocket_params.MAX_MESSAGE_SIZE,
      assembleFragments: true,
      autoAcceptConnections: false    // false => Use verify originIsAllowed method
    });
    this.wsServer.on('request', this.onWSRequest.bind(this));

    // Events from MsgBroker
    MsgBroker.once('ready', function() {
      Log.info('NS_UA_WS::start --> MsgBroker ready and connected');
      self.msgBrokerReady = true;
      self.checkReady();
    });

    MsgBroker.on('ready', this.subscribeQueues);

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
    MsgBroker.on('queuedisconnected', this.subscribeQueues);

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
    self.wsMaxConnections = limit;
  });
};

NS_UA_WS.prototype.stop = function(correctly) {
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

NS_UA_WS.prototype.onNewMessage = function(json) {
  Log.debug('WS::Queue::onNewMessage --> New message received: ', + json);
  // If we don't have enough data, return
  if (!json.uaid ||
    !json.payload ||
    !json.payload.ch ||
    !json.payload.vs) {
    Log.error(Log.messages.ERROR_WSNODATA);
    return;
  }
  Log.debug('WS::Queue::onNewMessage --> Notifying node:', json.uaid);
  Log.notify(Log.messages.NOTIFY_MSGSENTTOUA, {
    uaid: json.uaid,
    channelId: json.payload.ch,
    version: json.payload.vs
  });

  var nodeConnector = DataManager.getNodeConnector(json.uaid)
  if (nodeConnector) {
    /**
     {
       messageType: “notification”,
       updates: [{"channelID": "id", "version": "XXX"}, ...]
     }
     */
    var notification = {
      version: json.payload.vs,
      channelID: json.payload.ch
    };

    Log.debug('WS::Queue::onNewMessage --> Sending messages:', notification);
    nodeConnector.notify({
      messageType: 'notification',
      updates: [notification]
    });
  } else {
    Log.debug('WS::Queue::onNewMessage --> No node found');
  }
}

NS_UA_WS.prototype.subscribeQueues = function(broker) {
  var args = {
    durable: false,
    autoDelete: true,
    arguments: {
      'x-ha-policy': 'all'
    }
  };

  MsgBroker.subscribe(process.serverId, args, broker, NS_UA_WS.prototype.onNewMessage);
};

//////////////////////////////////////////////
// HTTP callbacks
//////////////////////////////////////////////
NS_UA_WS.prototype.onHTTPMessage = function(request, response) {
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
  if (!self.checkReady()) {
    Log.info('WS:onHTTPMessage --> Request received but not ready yet');
    response.res(errorcodes.NOT_READY);
    return;
  }

  Log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
  var url = self.parseURL(request.url);

  Log.debug('WS::onHTTPMessage --> Parsed URL:', url);
  switch (url.messageType) {
  case 'about':
    if (consts.PREPRODUCTION_MODE) {
      try {
        var p = new Pages();
        p.setTemplate('views/aboutWS.tmpl');
        text = p.render(function(t) {
          switch (t) {
          case '{{GIT_VERSION}}':
            return require('fs').readFileSync('version.info');
          case '{{MODULE_NAME}}':
            return 'User Agent Frontend';
          case '{{PARAM_TOKENSGENERATED}}':
            return this.TokensGenerated;
          case '{{PARAM_CONNECTIONS}}':
            return this.wsConnections;
          case '{{PARAM_MAXCONNECTIONS}}':
            return this.wsMaxConnections;
          case '{{PARAM_NUMPROCESSES}}':
            return config.numProcesses;
          default:
            return '';
          }
        }.bind(this));
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
          extradata: { messageType: query.messageType }
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
        process.nextTick(function() {
          self.getPendingMessages(connection.uaid, function(channelsUpdate) {
            if (!channelsUpdate) {
              connection.sendUTF('{}');
              return;
            }
            connection.res({
              errorcode: errorcodes.NO_ERROR,
              extradata: {
                messageType: 'notification',
                updates: channelsUpdate
              }
            });
          });
        });
        break;

      /*
        {
          messageType: "hello",
          uaid: "<a valid UAID>",
          channelIDs: [channelID1, channelID2, ...],
          wakeup_hostport: {
            ip: "<current device IP address>",
            port: "<TCP or UDP port in which the device is waiting for wake up notifications>"
          },
          mobilenetwork: {
            mcc: "<Mobile Country Code>",
            mnc: "<Mobile Network Code>"
          }
        }
       */
      case 'hello':
        if (!query.uaid || !Token.verify(query.uaid)) {
          query.uaid = Token.get();
          query.channelIDs = null;
          self.TokensGenerated++;
        }
        Log.debug('WS:onWSMessage --> Accepted uaid=' + query.uaid);
        connection.uaid = query.uaid;

        //KPI: 0x2000
        Log.notify(Log.messages.NOTIFY_HELLO, {
          uaid: connection.uaid,
          mcc: (query.mobilenetwork && query.mobilenetwork.mcc) || 0,
          mnc: (query.mobilenetwork && query.mobilenetwork.mnc) || 0
        });

        // New UA registration
        Log.debug('WS::onWSMessage --> HELLO - UA registration message');
        //query parameters are validated while getting the connector in
        // connectors/Connector.js
        DataManager.registerNode(query, connection, function onNodeRegistered(error, res, data) {
          if (error) {
            connection.res({
              errorcode: errorcodesWS.FAILED_REGISTERUA,
              extradata: { messageType: 'hello' }
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
              self.recoveryChannels(connection.uaid, query.channelIDs);
            });

            process.nextTick(function() {
              self.getPendingMessages(connection.uaid, function(channelsUpdate) {
                if (!channelsUpdate) {
                  return;
                }
                Log.debug('CHANNELS: ',channelsUpdate);
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    messageType: 'notification',
                    updates: channelsUpdate
                  }
                });
              });
            });
          }
          Log.debug('WS::onWSMessage --> OK register UA');
        });
        break;

      /**
        {
          messageType: "register",
          channelId: <channelId>
        }
       */
      case 'register':
        Log.debug('WS::onWSMessage::register --> Application registration message');

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

        DataManager.registerApplication(appToken, channelID, connection.uaid, null, function(error) {
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

      /**
        {
          messageType: "unregister",
          channelId: <channelId>
        }
       */
      case 'unregister':
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
                extradata: { messageType: 'unregister' }
              });
            } else {
              connection.res({
                errorcode: errorcodes.NOT_READY,
                extradata: { messageType: 'unregister' }
              });
            }
            Log.debug('WS::onWSMessage::unregister --> Failing unregistering channelID');
          }
        });
        break;

      /**
        {
            messageType: “ack”,
            updates: [{"channelID": channelID, “version”: xxx}, ...]
        }
       */
      case 'ack':
        if (!Array.isArray(query.updates)) {
          connection.res({
            errorcode: errorcodesWS.NOT_VALID_CHANNELID,
            extradata: { messageType: 'ack' }
          });
          connection.close();
          return;
        }

        query.updates.forEach(function(el) {
          if (!el.channelID || typeof el.channelID !== 'string' ||
              !Helpers.isVersion(el.version)) {
            connection.res({
              errorcode: errorcodesWS.NOT_VALID_CHANNELID,
              extradata: { messageType: 'ack',
                           channelID: el.channelID,
                           version: el.version}
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
        Log.debug('WS::onWSMessage::default --> messageType not recognized');
        connection.res({
          errorcode: errorcodesWS.MESSAGETYPE_NOT_RECOGNIZED
        });
        connection.close();
        return;
      }
    } else if (message.type === 'binary') {
      // No binary data supported yet
      Log.debug('WS::onWSMessage --> Received Binary Message of ' + message.binaryData.length + ' bytes');
      connection.res({
        errorcode: errorcodesWS.BINARY_MSG_NOT_SUPPORTED
      });
      connection.close();
    }
  };

  this.onWSClose = function(reasonCode, description) {
    self.wsConnections--;
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
  if (self.wsConnections >= self.wsMaxConnections) {
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
    this.wsConnections++;
    Log.debug('WS::onWSRequest --> Connection accepted.');
    connection.on('message', this.onWSMessage);
    connection.on('close', this.onWSClose);
    connection.res = function responseWS(payload) {
      Log.debug('WS::responseWS:', payload);
      var res = {};
      if (payload && payload.extradata) {
        res = payload.extradata;
      }
      if (payload && payload.errorcode[0] > 299) {    // Out of the 2xx series
        if (!res.status) {
          res.status = payload.errorcode[0];
        }
        res.reason = payload.errorcode[1];
      }
      connection.sendUTF(JSON.stringify(res));
    };
  } catch(e) {
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

NS_UA_WS.prototype.recoveryChannels = function(uaid, channelIDs) {
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
      DataManager.registerApplication(appToken, ch, uaid, null, function(error) {
        if (error) {
          Log.debug('WS::onWSMessage::recoveryChannels --> Failing registering channelID');
          return;
        }
        var notifyURL = Helpers.getNotificationURL(appToken);
        Log.debug('WS::onWSMessage::recoveryChannels --> OK registering channelID: ' + notifyURL);
      });
    });
  });
};

exports.NS_UA_WS = NS_UA_WS;
