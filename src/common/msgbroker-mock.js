/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var stomp = require('stomp');
var log = require("./logger.js").getLogger;
var queueconf = require("../config.js").queue;

function msgBroker() {}
//Mock msgBroker function for testing purposes (npm test in travis-ci)
msgBroker.prototype = {
  init: function(onConnect) {
    log.info('FAKE -- msgbroker::init --> Connected to fake msgBroker, calling the callback');
    onConnect();
    return;
  },

  close: function() {
    log.info('FAKE -- msgbroker::close --> Closing connection to fake msgBroker');
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

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _msgBroker = new msgBroker();
function getMsgBroker() {
  return _msgBroker;
}
exports.getMsgBroker = getMsgBroker;
