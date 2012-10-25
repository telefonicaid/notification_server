/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

/******************* Servers to run on this machine ********************/
/**
 * Put to true what you want to run
 */
exports.servers = {
  NS_AS: true,
  NS_MSG_monitor: true,
  NS_UA_WS: true,
  NS_UA_UDP: true,
  NS_WakeUp: true
};

////////////////////////////////////////////////////////////////////////
// Common configuration parameters
////////////////////////////////////////////////////////////////////////

/********************* Constants********************************************/
exports.consts = {
  MAX_PAYLOAD_SIZE: 1024,
  PREPRODUCTION_MODE: true,
  MAX_TTL: 2592000, // 30 days, in seconds (60*60*24*30)

  /**
   * This is the Key and the Certificate of the server. Should be shared
   * between all frontends that receive connections (NS_AS, NS_UA_WS).
   * Self-signed: http://stackoverflow.com/questions/9519707/can-nodejs-generate-ssl-certificates
   */

  key: '../test/scripts/server-key.pem',
  cert: '../test/scripts/server-cert.pem',

  /**
   * Public base URL to receive notifications. This will be the base to
   * append the /notify/12345abcdef… URL
   */
  publicBaseURL: "https://localhost:8081",

  /**
   * This must be shared between all your NS_UA_WS frontends.
   * This is used to verify if the token to register a UA comes from
   * this server
   */
  cryptokey: "12345678901234567890"
};

/********************* Logger parameters ***********************************/
var loglevel = require('./common/constants.js').loglevels;
exports.logger = {
  /**
   * Log levels:
   *
   * # NONE: Log disabled
   * # DEBUG: Very detailed information about all the things the server is doing
   * # INFO: General information about the things the server is doing
   * # ERROR: Error detected, but the server can continue working
   * # ALERT: Error detected but not directly on this process, so this is a
   *          notification that should be investigated
   * # NOTIFY: General notifications, ie. New connections
   * # CRITICAL: When a CRITICAL trace is sent the process will be STOPPED
   */
//  LOGLEVEL: loglevel.DEBUG | loglevel.INFO | loglevel.ERROR | loglevel.CRITICAL | loglevel.ALERT | loglevel.NOTIFY,
  LOGLEVEL: loglevel.NOTIFY,
  CONSOLEOUTPUT: 1,
  BASE_PATH: "/var/log/push_server/"
};

/********************* Common Queue ***********************************/
/**
 * Choose your host, port and other self-explanatory options
 */
exports.queue = [{
    host: '127.0.0.1',
    port: 5672, //AMQP default port
    login: 'guest',
    password: 'guest'
  },
  {
    host: '127.0.0.1',
    port: 5672, //AMQP default port
    login: 'guest',
    password: 'guest'
  },
  {
    host: '127.0.0.1',
    port: 5672, //AMQP default port
    login: 'guest',
    password: 'guest'
  }
];

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

////////////////////////////////////////////////////////////////////////
//Different configurations for the servers
////////////////////////////////////////////////////////////////////////

/********************* NS_AS *****************************************/
exports.NS_AS = {
  logfile: "NS_AS.log",

  /**
   * Binding interfaces and ports to listen to. You can have multiple processes.
   */
  interfaces: [
    {
      ip: "0.0.0.0",
      port: 8081
    }
  ]
};

/********************* NS_MSG_monitor ********************************/

exports.NS_Monitor = {
  logfile: "NS_Monitor.log"
};

/********************* NS_UA_WS **************************************/

exports.NS_UA_WS = {
  logfile: "NS_UA_WS.log",

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

  /**
   * Websocket configuration
   * @see https://github.com/Worlize/WebSocket-Node/blob/master/lib/WebSocketServer.js
   * Be sure to know exactly what are you changing. Short keepaliveIntervals
   * on 3G networks causes a lot of signalling and also dropping too many connections
   * because timeouts on handset status change time.
   */
  websocket_params: {
    keepalive: true,
    keepaliveInterval: 40000,
    dropConnectionOnKeepaliveTimeout: true,
    keepaliveGracePeriod: 30000
  }
};

/********************* NS_UA_UDP *************************************/

exports.NS_UA_UDP = {
  logfile: "NS_UA_UDP.log"
};

/********************* NS_WakeUp *************************************/

exports.NS_WakeUp = {
  logfile: "NS_WakeUp.log",

  /**
   * Binding interfaces and ports
   * [ iface, port ]
   */
  interfaces: [
    // Internal network
    {
      ip: "0.0.0.0",
      port: 8090
    }
  ]
};

/********************* NS start.js ***********************************/

exports.NS = {
  logfile: "NS.log"
};
