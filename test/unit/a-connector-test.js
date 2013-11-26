/* jshint node:true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var assert = require('assert'),
    vows = require('vows'),
    Connector = require('../../src/ns_ua/connectors/Connector').getConnector(),
    ConnectorUDP = require('../../src/ns_ua/connectors/ConnectorUDP'),
    ConnectorWebSocket = require('../../src/ns_ua/connectors/ConnectorWebSocket');

var connection = {
  close: function close() {
    return true;
  }
};

var dataWS = {
  uaid: 'WS'
};

var dataWS2 = {
  uaid: 'WS2'
};

var dataUDP = {
  uaid: 'UDP',
  wakeup_hostport: {
    ip: '1.1.1.1',
    port: 1111
  },
  mobilenetwork: {
    mcc: '214',
    mnc: '07'
  }
};


vows.describe('Connector tests').addBatch({
  'register WS connector': {
    topic: function() {
      Connector.getConnector(dataWS, connection, this.callback);
    },
    'registered': function(error, connector) {
      assert.isNull(error);
      assert.instanceOf(connector, ConnectorWebSocket);

      assert.isFunction(connector.getType);
      assert.equal(connector.getType(), 'WS');

      assert.isFunction(connector.getConnection);

      assert.isFunction(connector.getInterface);
      assert.isNull(connector.getInterface());

      assert.isFunction(connector.getMobileNetwork);
      assert.isNull(connector.getMobileNetwork());

      assert.isFunction(connector.getProtocol);
      assert.equal(connector.getProtocol(), 'ws');

      assert.isFunction(connector.canBeWakeup);
      assert.isFalse(connector.canBeWakeup());

      assert.isFunction(connector.resetAutoclose);
      assert.isUndefined(connector.resetAutoclose());

      assert.isFunction(connector.notify);
    },
    'get registered WS connector': {
      topic: Connector.getConnectorForUAID(dataWS.uaid),
      'is empty': function (topic) {
        assert.isNotNull(topic);
        assert.instanceOf(topic, ConnectorWebSocket);
      }
    },
    'unregister WS connector': {

    },
  }/*,
  'register UDP connector': {
    topic: function() {
      Connector.getConnector(dataUDP, connection, this.callback);
    },
    'registered': function(error, connector) {
      assert.isNull(error);
      assert.instanceOf(connector, ConnectorUDP);

      assert.isFunction(connector.getType);
      assert.equal(connector.getType(), 'UDP');

      assert.isFunction(connector.getConnection);

      assert.isFunction(connector.getServer);
      assert.equal(connector.getServer(), 'UDP');

      assert.isFunction(connector.getInterface);
      assert.deepEqual(connector.getInterface(), dataUDP.wakeup_hostport);

      assert.isFunction(connector.getMobileNetwork);
      assert.deepEqual(connector.getMobileNetwork(), dataUDP.mobilenetwork);

      assert.isFunction(connector.getProtocol);
      assert.equal(connector.getProtocol(), 'udp');

      assert.isFunction(connector.canBeWakeup);
      assert.isTrue(connector.canBeWakeup());

      assert.isFunction(connector.resetAutoclose);
      
      assert.isFunction(connector.notify);
    },
    'get registered UDP connector': {
      topic: Connector.getConnectorForUAID('hola'),
      'is empty': function (topic) {
        assert.isNull(topic);
      }
    },
    'unregister UDP connector': {

    },
  },*/
}).export(module);
