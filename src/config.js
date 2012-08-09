/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

/******************* Servers to run on this machine ********************/
/**
 * Put to true what you want to run
 */
exports.servers = {
  NS_AS: true,
  NS_MSG_monitor: false,
  NS_UA_WS: false,
  NS_UA_UDP: false,
  NS_UA_SMS: false
}

////////////////////////////////////////////////////////////////////////
//Different configurations for the servers
////////////////////////////////////////////////////////////////////////

/********************* Common Queue ***********************************/
/**
 * This has been tested with ActiveMQ >= 5.6.
 * Choose your host, port and other self-explanatory options
 */
exports.queue = {
  host: 'localhost',
  port: 61613,
  debug: false,
  //Just for rabbitmq
  login: 'guest',
  passcode: 'guest'
};

/********************* Database configuration *************************/
/**
 * If replicasetName is not set, we ONLY use the first machine, and
 * connect to a single mongo instance.
 */

//DDBB defaults to using MongoDB in a replicaset
/*exports.ddbbsettings = {
  machines: [
    ["owd-push-qa-be1", 27017],
    ["owd-push-qa-be2", 27017]
  ],
  ddbbname: "push_notification_server",
  replicasetName: "Server_Push"
};*/

//DDBB defaults to use a single MongoDB instance
exports.ddbbsettings = {
  machines: [
    ["127.0.0.1", 27017]
  ],
  ddbbname: "push_notification_server",
  replicasetName: null
};


/********************* NS_AS *****************************************/
/**
 * Public base URL to receive notifications. This will be the base to
 * append the /notify/12345abcdef… URL
 */
exports.NS_AS = {
  publicBaseURL: "http://localhost:8081",

  /**
   * Binding interfaces and ports to listen to. You can have multiple processes.
   */
  interfaces: [
    {
      ip: "0.0.0.0",
      port: 8081
    }
  ],

  /**
   * This must be shared between all your NS_AS frontends.
   * This is used to verify if the token to register a UA comes from
   * this server
   */
  server_info: {
    key: "12345678901234567890"
  }
};

/********************* NS_MSG_monitor ********************************/
/**
 * No conf, yet!
 */

/********************* NS_UA_WS **************************************/

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

  /**
   * Websocket configuration
   * @see https://github.com/Worlize/WebSocket-Node/blob/master/lib/WebSocketServer.js
   */
  websocket_params: {
    keepalive: true,
    keepaliveInterval: 40000,
    dropConnectionOnKeepaliveTimeout: true,
    keepaliveGracePeriod: 30000
  }
};

/********************* NS_UA_UDP *************************************/


/********************* NS_UA_SMS *************************************/
