/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

exports.loglevels = {
  // Log levels bitwise
  NONE: 0,
  CRITICAL: 1,
  DEBUG: 2,
  INFO: 4,
  ERROR: 8,
  NOTIFY: 16,
  ALERT: 32,
  ALARM: 64
};

exports.errorcodes = {
  GENERAL: {
    NO_ERROR: [200, 'Ok'],
    GENERIC_ERROR: [400, 'Generic error'],
    NOT_ALLOWED_ON_PRODUCTION_SYSTEM: [403, 'Not allowed on production system'],
    NOT_READY: [408, 'Not ready yet: Try again later']
  },
  AS: {
    JSON_NOTVALID_ERROR: [450, 'JSON not valid error'],
    BAD_URL: [404, 'Bad URL'],
    BAD_URL_NOT_VALID_APPTOKEN: [451, 'No valid apptoken'],
    BAD_URL_NOT_VALID_METHOD: [405, 'No valid HTTP method'],
    BAD_MESSAGE_TYPE_NOT_NOTIFICATION: [452, 'Not messageType=notification'],
    BAD_MESSAGE_BAD_ID: [454, 'Bad id'],
    BAD_MESSAGE_BODY_TOO_BIG: [413, 'Body too big'],
    BAD_MESSAGE_BAD_CERTIFICATE: [455, 'Bad certificate, dropping notification']
  },
  UAWS: {
    // HTTP
    BAD_MESSAGE_NOT_RECOGNIZED: [405, 'messageType not recognized for this HTTP API'],

    // WebSocket
    NOT_VALID_JSON_PACKAGE: [450, 'Data received is not a valid JSON package'],
    NOT_VALID_CHANNELID: [457, 'Not valid channelID sent'],
    NOT_VALID_CERTIFICATE_URL: [458, 'Not valid Certificate URL sent'],
    UAID_NOT_FOUND: [459, 'No UAID found for this connection!'],
    FAILED_REGISTERUA: [460, 'Failed registering UAID'],
    ERROR_GETTING_CONNECTOR: [461, 'Error getting connection object'],
    COMMAND_NOT_ALLOWED: [405 , 'Command not allowed in this connection'],
    UAID_NOT_SENT: [462, 'No UAID sent'],
    MESSAGETYPE_NOT_RECOGNIZED: [405, 'messageType not recognized'],
    BINARY_MSG_NOT_SUPPORTED: [463, 'Binary messages not yet supported']
  }
};

exports.connectionstate = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  WAKEUP: 2         // UDP, don't know
};

exports.statuscodes = {
  OK: 200,
  REGISTERED: 200,
  UDPREGISTERED: 201,
  UNREGISTERED: 202
}