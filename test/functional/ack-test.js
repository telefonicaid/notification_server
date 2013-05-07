var assert = require('assert'),
    vows = require('vows'),
    debug = require('./common').debug;

var newWebsocket = function newWebsocket(message, callback) {
  var WebSocketClient = require('websocket').client;
  var client = new WebSocketClient();
  var self = this;
  var connection = null;

  client.on('connectFailed', function(error) {
    debug('Connect Error: ' + error.toString());
    callback('Error ' + error.toString());
  });

  client.on('error', function(error) {
    debug('Connect Error: ' + error.toString());
    callback('Error ' + error.toString());
  });

  client.on('connect', function(connection) {
    debug('Going to send the hello message');
    connection.sendUTF('{ "messageType": "hello"}');
    self.connection = connection;
    setTimeout(function() {
      debug('Sending the original message');
      connection.sendUTF(message);
    }, 100);
    connection.on('message', function(message) {
      debug('Message received -- ' + message.utf8Data);
      if (JSON.parse(message.utf8Data).messageType !== 'hello') {
        if (JSON.parse(message.utf8Data).status) {
          callback('Error');
        } else {
          callback(/*error*/null, message.utf8Data);
        }
      }
    });
  });

  client.on('close', function() {
    debug('Closed!!');
    callback('Closed');
  });
  client.connect('wss://localhost:8080/', 'push-notification');

  setTimeout(function() {
    debug('closing');
    callback('Closed');
    self.connection.close();
  }, 3000);
};


vows.describe('ACK messages').addBatch({
  'Invalid messages': {
    'no updates': {
      topic: function() {
        new newWebsocket('{"messageType": "ack"}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'not updates as array': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":3}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'empty updates as array': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[]', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'empty update[0] object': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'null channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": null, "version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'no channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    '{} channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": {}, "version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    '{ddd} channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": {ddd}, "version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'no version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola"]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'empty version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'null version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": null]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'string version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "asdfasdf"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    'object version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": {}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    '"" version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": ""}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    },
    '"{""} version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "{""}}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.isNotNull(error);
      }
    }
  }
}).export(module);
