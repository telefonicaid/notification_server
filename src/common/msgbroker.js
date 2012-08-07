/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var stomp = require('stomp');
var log = require("./logger.js").getLogger;
var queueconf = require("../config.js").queue;

//Testing vars
var TESTING = require("../consts.js").consts.TESTING;

function msgBroker() {}

//Mock msgBroker function for testing purposes (npm test in travis-ci)
if (TESTING) {
  msgBroker.prototype = {
    init: function(onConnect) {
      log.debug('FAKE -- msgbroker::init --> Connected to fake msgBroker, calling the callback');
      onConnect();
      return;
    },

    close: function() {
      log.debug('FAKE -- msgbroker::close --> Closing connection to fake msgBroker');
      return;
    },

    subscribe: function(queueName, callbackFunc) {
      log.debug('FAKE -- msgbroker::init --> Connected to fake msgBroker queue ' +  queueName + '. Calling callback');
      callbackFunc();
      return;
    },

    push: function(queueName, body, persistent) {
      log.debug('FAKE -- msgbroker::push --> Pushing message to fake msgBroker. Queue: ' + queueName + ', body: ' + body + ', persistent: ' + persistent);
      return;
    }
  };
} else {
  msgBroker.prototype = {
    init: function(onConnect) {
      this.queue = new stomp.Stomp({
        port: queueconf.port,
        host: queueconf.host,
        debug: queueconf.debug,
        // login and passcode may be optional (required by rabbitMQ)
        login: queueconf.user,
        passcode: queueconf.password
      });

      this.queue.connect();
      // Queue Events
      this.queue.on('connected', (function() {
        log.debug("Connected to Message Broker");
        onConnect();
      }));
      this.queue.on('receipt', function(receipt) {
        log.debug("RECEIPT: " + receipt);
      });
      this.queue.on('error', (function(error_frame) {
        log.error('We cannot connect to the message broker on ' + queueconf.host + ':' + queueconf.port + ' -- ' + error_frame.body);
        this.close();
      }).bind(this));
    },

    close: function() {
      if(this.queue) {
        this.queue.disconnect();
        this.queue = null;
      }
    },

    subscribe: function(queueName, callbackFunc) {
      this.queue.on('message', callbackFunc);
      this.queue.subscribe({
        destination: '/queue/' + queueName,
        ack: 'auto'
      });
      log.debug("Subscribed to Message Broker /queue/" + queueName);
    },

    /**
     * Insert a new message into the queue
     */
    push: function(queueName, body, persistent) {
      log.debug('Going to send ' + JSON.stringify(body));
      this.queue.send({
        'destination': '/queue/' + queueName,
        'body': JSON.stringify(body),
        'persistent': persistent
      }, true); //receipt
    }
  };
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _msgBroker = new msgBroker();
function getMsgBroker() {
  return _msgBroker;
}
exports.getMsgBroker = getMsgBroker;
