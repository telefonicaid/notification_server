/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require('../common/logger.js'),
    WebSocketServer = require('websocket').server,
    fs = require('fs'),
    cluster = require('cluster'),
    crypto = require('../common/cryptography.js'),
    dataManager = require('./datamanager.js'),
    helpers = require('../common/helpers.js'),
    msgBroker = require('../common/msgbroker.js'),
    config = require('../config.js').NS_UA_WS,
    consts = require('../config.js').consts,
    errorcodes = require('../common/constants').errorcodes.GENERAL,
    errorcodesWS = require('../common/constants').errorcodes.UAWS,
    counters = require('../common/counters'),
    url = require('url'),
    http = require('http'),
    https = require('https');

var apis = {
  http: [],
  ws: []
};
apis.http[0] = require('./apis/infoAPI');
apis.ws['push-notification'] = require('./apis/SimplePushAPI_WS_v1');
apis.ws['push-extendednotification'] = require('./apis/ExtendedPushAPI_WS_v1');

function server(ip, port, ssl) {
  this.ip = ip;
  this.port = port;
  this.ssl = ssl;
  this.ready = false;
  counters.set('wsMaxConnections', 1000);
  counters.set('numProcesses', config.numProcesses);
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////
  init: function() {

    if (cluster.isMaster) {
      // Fork workers.
      for (var i = 0; i < config.numProcesses; i++) {
        cluster.fork();
      }

      cluster.on('exit', function(worker, code, signal) {
        if (code !== 0) {
          log.error('worker ' + worker.process.pid + ' closed unexpectedly with code ' + code);
        } else {
          log.info('worker ' + worker.process.pid + ' exit');
        }
      });
    } else {
      // Create a new HTTP(S) Server
      if (this.ssl) {
        var options = {
          key: fs.readFileSync(consts.key),
          cert: fs.readFileSync(consts.cert)
        };
        this.server = require('https').createServer(options, this.onHTTPMessage.bind(this));
      } else {
        this.server = require('http').createServer(this.onHTTPMessage.bind(this));
      }
      this.server.listen(this.port, this.ip);
      log.info('WS::server::init --> HTTP' + (this.ssl ? 'S' : '') +
               ' push UA_WS server running on ' + this.ip + ':' + this.port);

      // Websocket init
      this.wsServer = new WebSocketServer({
        httpServer: this.server,
        keepalive: config.websocket_params.keepalive,
        keepaliveInterval: config.websocket_params.keepaliveInterval,
        dropConnectionOnKeepaliveTimeout: config.websocket_params.dropConnectionOnKeepaliveTimeout,
        keepaliveGracePeriod: config.websocket_params.keepaliveGracePeriod,
        autoAcceptConnections: false    // false => Use verify originIsAllowed method
      });
      this.wsServer.on('request', this.onWSRequest.bind(this));

      // Subscribe to my own Queue
      var self = this;
      msgBroker.on('brokerconnected', function() {
        var args = {
          durable: false,
          autoDelete: true,
          arguments: {
            'x-ha-policy': 'all'
          }
        };
        msgBroker.subscribe(process.serverId, args, function onNewMessage(message) {
          log.debug('WS::Queue::onNewMessage --> New message received: ' + message);
          var json = {};
          try {
            json = JSON.parse(message);
          } catch (e) {
            log.debug('WS::Queue::onNewMessage --> Not a valid JSON');
            return;
          }
          // If we don't have enough data, return
          if (!json.uaid ||
              !json.payload) {
            return log.error('WS::queue::onNewMessage --> Not enough data!');
          }
          log.debug('WS::Queue::onNewMessage --> Notifying node:', json.uaid);
          log.notify('Message with id ' + json.messageId + ' sent to ' + json.uaid);
          dataManager.getNode(json.uaid, function(nodeConnector) {
            if (nodeConnector) {
              var notification = json.payload;

              // Not send the appToken
              //TODO: Not insert the appToken into the MQ
              /**
                {
                  messageType: “notification”,
                  updates: [{"channelID": "id", "version": "XXX"}, ...]
                }

                {
                  messageType: "desktopNotification",
                  updates: [{"channelID": "version", _internal_id: ..., "body": "body"}, ...]
                }
              */
              delete notification.appToken;
              delete notification.app;
              if (notification.ch) {
                notification.channelID = notification.ch;
                delete notification.ch;
              }
              if (notification.vs) {
                notification.version = notification.vs;
                delete notification.vs;
              }
              log.debug('WS::Queue::onNewMessage --> Sending messages:', notification);
              if (notification.body) {
                nodeConnector.notify({
                  messageType: "desktopNotification",
                  updates: new Array(notification)
                });
              } else {
                nodeConnector.notify({
                  messageType: "notification",
                  updates: new Array(notification)
                });
              }
            } else {
              log.debug('WS::Queue::onNewMessage --> No node found');
            }
          });
        });
        self.ready = true;
      });
      msgBroker.on('brokerdisconnected', function() {
        log.critical('ns_ws::init --> Broker DISCONNECTED!!');
      });

      //Connect to msgBroker
      process.nextTick(function() {
        msgBroker.init();
      });

      //Check if we are alive
      setTimeout(function() {
        if (!self.ready)
          log.critical('30 seconds has passed and we are not ready, closing');
      }, 30 * 1000); //Wait 30 seconds
    }

    // Check ulimit
    helpers.getMaxFileDescriptors(function(error,ulimit) {
      if (error) {
        return log.error('ulimit error: ' + error);
      }
      log.debug('ulimit = ' + ulimit);
      counters.set('wsMaxConnections', ulimit - 200);
    }.bind(this));

  },

  //////////////////////////////////////////////
  // HTTP callbacks
  //////////////////////////////////////////////
  onHTTPMessage: function(request, response) {
    response.res = function responseHTTP(errorCode, html) {
      log.debug('NS_UA_WS::responseHTTP: ', errorCode);
      this.statusCode = errorCode[0];
      this.setHeader('access-control-allow-origin', '*');
      if (html) {
        this.setHeader('Content-Type', 'text/html');
        this.write(html);
      } else {
        if (consts.PREPRODUCTION_MODE) {
          this.setHeader('Content-Type', 'text/plain');
          if (this.statusCode == 200) {
                this.write('{"status":"ACCEPTED"}');
          } else {
            this.write('{"status":"ERROR", "reason":"' + errorCode[1] + '"}');
          }
        }
      }
      return this.end();
    };

    var text = null;
    if (!this.ready) {
      log.info('WS:onHTTPMessage --> Request received but not ready yet');
      return response.res(errorcodes.NOT_READY);
    } else {
      log.debug('WS::onHTTPMessage --> Received request for ' + request.url);
      var url = this.parseURL(request.url);
      log.debug('WS::onHTTPMessage --> Parsed URL:', url);

      // Process received message with one of the loaded APIs
      var self = this;
      function processMsg(request, body, response, url) {
        var validAPI = false;
        for (var i=0; i<apis.http.length; i++) {
          if (apis.http[i].processRequest(request, body, response, url)) {
            log.debug('WS::onHTTPMessage::processMsg -> Cool, HTTP API accepted !');
            validAPI = true;
            break;
          }
        }
        if (!validAPI) {
          log.debug('WS::onHTTPMessage --> messageType not recognized');
          return response.res(errorcodesWS.BAD_MESSAGE_NOT_RECOGNIZED);
        }
      }
      if (request.method == 'PUT' || request.method == 'POST') {
        request.on('data', function(body) {
          processMsg(request, body, response, url);
        });
      } else {
        processMsg(request, '', response, url);
      }
    }
  },

  //////////////////////////////////////////////
  // WebSocket callbacks
  //////////////////////////////////////////////
  onWSRequest: function(request) {
    // Common variables
    var appToken = null;
    var self = this;

    ///////////////////////
    // WS Callbacks
    ///////////////////////
    var self = this;
    this.onWSClose = function(reasonCode, description) {
      counters.dec('wsConnections');
      dataManager.unregisterNode(connection.uaid);
      log.debug('WS::onWSClose --> Peer ' + connection.remoteAddress + ' disconnected with uaid ' + connection.uaid);
    };

    /**
     * Verify origin in order to accept or reject connections
     */
    this.originIsAllowed = function(origin) {
      // TODO: put logic here to detect whether the specified origin is allowed. Issue #64
      return true;
    };

    ///////////////////////
    // Websocket creation
    ///////////////////////

    // Check limits
    if (counters.get('wsConnections') >= counters.get('wsMaxConnections')) {
      log.debug('WS::onWSRequest --> Connection unaccepted. To many open connections');
      return request.reject();
    }

    // Abuse controls
    if (!this.originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      log.debug('WS:: --> Connection from origin ' + request.origin + ' rejected.');
      return request.reject();
    }

    // Connection accepted only for loaded sub-protocols
    // Client could inform multiple protocols. In this version we only care about only one
    log.debug('WS::onWSRequest: Client subprotocols: ',request.requestedProtocols);
    var subprotocol = "";
    var accepted = false;
    for (i in request.requestedProtocols) {
      subprotocol = request.requestedProtocols[i];
      log.debug('WS::onWSRequest: Testing subprotocol: ' + subprotocol);
      if (!apis.ws[subprotocol]) {
        log.debug('WS::onWSRequest: Subprotocol ' + subprotocol + ' not supported');
        continue;
      }
      try {
        var connection = request.accept(subprotocol, request.origin);
        counters.inc('wsConnections');
        log.debug('WS::onWSRequest --> Connection accepted with subprotocol: ' + subprotocol);
        connection.on('message', function(message) {
          apis.ws[subprotocol](message,connection);
        });
        connection.on('close', this.onWSClose);
        accepted = true;
        break;
      } catch(e) {
        log.debug('WS::onWSRequest --> Connection from origin ' + request.origin + ' rejected. Bad WebSocket sub-protocol.');
        return request.reject();
      }
    }
    if (!accepted) {
      log.debug('WS::onWSRequest --> Connection from origin ' + request.origin + ' rejected. Bad WebSocket sub-protocol.');
      return request.reject();
    }
  },

  ///////////////////////
  // Auxiliar methods
  ///////////////////////
  parseURL: function(url) {
    // TODO: Review logic of this method. Issue #65
    var urlparser = require('url');
    var data = {};
    data.parsedURL = urlparser.parse(url, true);
    var path = data.parsedURL.pathname.split('/');
    data.messageType = path[1];
    if (path.length > 2) {
      data.token = path[2];
    } else {
      data.token = data.parsedURL.query.token;
    }
    return data;
  },

  stop: function() {
    if (cluster.isMaster) {
      setTimeout(function() {
        process.exit(0);
      }, 10000);
      return;
    }
    log.info('WS::stop --> Closing WS server');
    //Server not ready
    this.ready = false;
    //Closing connection with msgBroker
    msgBroker.close();
    //Closing connections from the server
    this.server.close();
  }
};

// Exports
exports.server = server;
