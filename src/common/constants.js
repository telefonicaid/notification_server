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
    BAD_MESSAGE_NOT_SIGNED: [453, 'Not signed'],
    BAD_MESSAGE_NOT_ID: [454, 'Not id'],
    BAD_MESSAGE_BODY_TOO_BIG: [413, 'Body too big'],
    BAD_MESSAGE_BAD_SIGNATURE: [455, 'Bad signature, dropping notification']
  },
  UAWS: {
    // HTTP
    BAD_MESSAGE_NOT_RECOGNIZED: [405, 'messageType not recognized for this HTTP API'],

    // WebSocket
    NOT_VALID_JSON_PACKAGE: [450, 'Data received is not a valid JSON package'],
    NOT_VALID_UATOKEN: [456, 'UAtoken not valid for this server. Get a new one'],
    NOT_VALID_WATOKEN: [457, 'Not valid WAtoken sent'],
    NOT_VALID_PBK: [458, 'Not valid PbK sent'],
    UATOKEN_NOT_FOUND: [459, 'No UAtoken found for this connection!'],
    FAILED_REGISTERUA: [460, 'Failed registering UAtoken'],
    ERROR_GETTING_CONNECTOR: [461, 'Error getting connection object'],
    COMMAND_NOT_ALLOWED: [405 , 'Command not allowed in this connection'],
    UATOKEN_NOT_SENT: [462, 'No UAtoken sent'],
    MESSAGETYPE_NOT_RECOGNIZED: [405, 'messageType not recognized'],
    BINARY_MSG_NOT_SUPPORTED: [463, 'Binary messages not yet supported']
  }
};
