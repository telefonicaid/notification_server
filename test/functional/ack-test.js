var assert = require('assert'),
    vows = require('vows'),
    debug = require('./common').debug;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var newWebsocket = function newWebsocket(message, callback) {
  var WebSocketClient = require('websocket').client;
  var client = new WebSocketClient();
  var self = this;
  var connection = null;

  client.on('connectFailed', function(error) {
    debug('Connect Error: ' + error.toString());
    callback('Error ' + error.toString());
    clearTimeout(t);
  });

  client.on('error', function(error) {
    debug('Connect Error: ' + error.toString());
    callback('Error ' + error.toString());
    clearTimeout(t);
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
        var status = JSON.parse(message.utf8Data).status;
        if (status) {
          callback(status);
          clearTimeout(t);
        } else {
          callback(/*error*/null, message.utf8Data);
          clearTimeout(t);
        }
      }
    });
  });

  client.connect('wss://localhost:8080/', 'push-notification');

  /**
   * No error!!
   */
  var t = setTimeout(function() {
    callback(null);
  }, 5000);
};


vows.describe('ACK messages').addBatch({
  'Invalid messages': {
    'no updates': {
      topic: function() {
        new newWebsocket('{"messageType": "ack"}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    'not updates as array': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":3}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    'empty updates as array': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[]', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 450);
      }
    },
    'empty update[0] object': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    'null channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": null, "version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    'no channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    '{} channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": {}, "version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    '{ddd} channelID': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": {ddd}, "version": "2"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 450);
      }
    },
    'no version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola"]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 450);
      }
    },
    'empty version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 450);
      }
    },
    'null version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": null]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 450);
      }
    },
    'string version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "asdfasdf"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    'object version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": {}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 450);
      }
    },
    '"" version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": ""}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    'negative version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "-1"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    //9007199254740992
    'too big version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "9007199254740992"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    //9007199254740993
    'too big version 9007199254740993': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "9007199254740993"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    //9007199254741000
    'too big version 9007199254741000': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "9007199254741000"}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 457);
      }
    },
    '"{""} version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "{""}}]}', this.callback);
      },
      'Should end up with an error': function(error, message) {
        assert.equal(error, 450);
      }
    }
  },
  'Valid messages': {
    '0 version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "0"}]}', this.callback);
      },
      'End up without error': function(error, message) {
        assert.isNull(error);
      }
    },
    '1 version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "1"}]}', this.callback);
      },
      'End up without error': function(error, message) {
        assert.isNull(error);
      }
    },
    'limit (9007199254740991) version': {
      topic: function() {
        new newWebsocket('{"messageType": "ack", "updates":[{"channelID": "holahola", "version": "9007199254740991"}]}', this.callback);
      },
      'End up without an error': function(error, message) {
        assert.isNull(error);
      }
    }
  }
}).export(module);
