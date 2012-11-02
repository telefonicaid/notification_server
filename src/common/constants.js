
exports.loglevels = {
  // Log levels bitwise
  NONE: 0,
  CRITICAL: 1,
  DEBUG: 2,
  INFO: 4,
  ERROR: 8,
  NOTIFY: 16,
  ALERT: 32
}

exports.errorcodes = {
  GENERAL: {
    NO_ERROR: [200, "Ok"],
    GENERIC_ERROR: [400, "Generic error"],
    NOT_ALLOWED_ON_PRODUCTION_SYSTEM: [404, "Not allowed on production system"],
    NOT_READY: [404, "Not ready yet: Try again later"]
  },
  AS: {
    JSON_NOTVALID_ERROR: [401, "JSON not valid error"],
    BAD_URL: [402, "Bad URL"],
    BAD_URL_NOT_VALID_APPTOKEN: [404, "No valid apptoken"],
    BAD_URL_NOT_VALID_METHOD: [404, "No valid HTTP method"],
    BAD_MESSAGE_TYPE_NOT_NOTIFICATION: [403, "Not messageType=notification"],
    BAD_MESSAGE_NOT_SIGNED: [405, "Not signed"],
    BAD_MESSAGE_NOT_ID: [406, "Not id"],
    BAD_MESSAGE_NOT_SIGNED: [407, "Body too big"],
    BAD_MESSAGE_BAD_SIGNATURE: [408, "Bad signature, dropping notification"]
  },
  UAWS: {
    // HTTP
    BAD_MESSAGE_NOT_RECOGNIZED: [404, "messageType not recognized for this HTTP API"],

    // WebSocket
    NOT_VALID_JSON_PACKAGE: [400, "Data received is not a valid JSON package"],
    NOT_VALID_UATOKEN: [400, "UAtoken not valid for this server. Get a new one"],
    NOT_VALID_WATOKEN: [400, "Not valid WAtoken sent"],
    NOT_VALID_PBK: [400, "Not valid PbK sent"],
    UATOKEN_NOT_FOUND: [400, "No UAtoken found for this connection!"],
    FAILED_REGISTERUA: [400, "Failed registering UAtoken"],
    ERROR_GETTING_CONNECTOR: [400, "Error getting connection object"],
    COMMAND_NOT_ALLOWED: [400 , "Command not allowed in this connection"],
    UATOKEN_NOT_SENT: [400, "No UAtoken sent"],
    MESSAGETYPE_NOT_RECOGNIZED: [400, "messageType not recognized"],
    BINARY_MSG_NOT_SUPPORTED: [400, "Binary messages not yet supported"]
  }
}