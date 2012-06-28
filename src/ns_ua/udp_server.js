/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var log = require("../common/logger.js").getLogger;
var dataManager = require("./datamanager.js").getDataManager();
var msgBroker = require("../common/msgbroker.js").getMsgBroker();
var dgram = require('dgram');

////////////////////////////////////////////////////////////////////////////////
// Callback functions
////////////////////////////////////////////////////////////////////////////////

function onNewMessage(messageId) {
  log.debug("MB: " + messageId.body + " | Headers: " + messageId.headers['message-id']);
  
	// Recover message from the data store. Body contains the Destination UAToken
	dataManager.getMessage(JSON.parse(messageId.body).messageId.toString(), onMessage, JSON.parse(messageId.body));
}

function onMessage(messageData) {
  log.debug("Message data: " + JSON.stringify(messageData));
  log.debug("Notifying node: " + JSON.stringify(messageData.data.uatoken));

  // Notify the hanset with the associated Data
  console.log("Notify to " +
      messageData.data.data.interface.ip + ":" + messageData.data.data.interface.port
  );

  // UDP Notification Message
    var message = new Buffer("NOTIFY " + JSON.stringify(messageData));
    var client = dgram.createSocket("udp4");
    client.send(
      message, 0, message.length, 
      messageData.data.data.interface.port, messageData.data.data.interface.ip,
      function(err, bytes) {
        client.close();
      }
    );
}

////////////////////////////////////////////////////////////////////////////////

function server() {
}

server.prototype = {
  //////////////////////////////////////////////
  // Constructor
  //////////////////////////////////////////////

  init: function() {
    log.info("Starting UA-UDP server");

    // Subscribe to the UDP common Queue
    msgBroker.init(function() {
      msgBroker.subscribe("UDP", function(msg) { onNewMessage(msg); });
    });
  }
};

// Exports
exports.server = server;
