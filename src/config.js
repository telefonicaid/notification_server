/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

/******************* Servers to run on this machine ********************/
exports.servers = {
  NS_AS: true,
  NS_MSG_monitor: true,
  NS_UA_WS: true,
  NS_UA_UDP: false,
  NS_UA_SMS: false
}

/********************* Common Queue ***********************************/
exports.queue = {
  port: 61613,
  host: 'owd-push-qa-be1',
  debug: false,
  //Just for rabbitmq
  login: 'guest',
  passcode: 'guest'
};

exports.ddbbsettings = {
  machines: [
    ["owd-push-qa-be1", 27017],
    ["owd-push-qa-be2", 27017]
  ],
  ddbbname: "push_notification_server",
  replicasetName: "Server_Push"
};


/********************* NS_AS *****************************************/
/**
 * Public base URL to receive notifications
 */
exports.NS_AS = {
  publicBaseURL: "http://localhost:8081",

  /**
   * Binding interfaces and ports
   * [ iface, port ]
   */
  interfaces: [
    {
      ip: "0.0.0.0",
      port: 8081
    }
  ],

  /**
   * This should be shared between all your frontends (to verify token)
   */
  server_info: {
    key: "12345678901234567890"
  }
};

/********************* NS_MSG_monitor ********************************/


/********************* NS_UA_WS **************************************/

/**
 * Websocket configuration
 * @see https://github.com/Worlize/WebSocket-Node/blob/master/lib/WebSocketServer.js
 */
exports.NS_UA_WS = {
  /**
   * Binding interfaces and ports
   * [ iface, port ]
   */
  interfaces: [
    // Internal network
    {
      ip: "0.0.0.0",
      port: 8080
    }
  ],

  server_info: {
    key: "12345678901234567890"
  },

  websocket_params: {
    keepalive: true,
    keepaliveInterval: 40000,
    dropConnectionOnKeepaliveTimeout: true,
    keepaliveGracePeriod: 30000
  }
};

/********************* NS_UA_UDP *************************************/


/********************* NS_UA_SMS *************************************/
