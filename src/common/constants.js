
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
    BAD_MESSAGE_TYPE_NOT_NOTIFICATION: [403, "Not messageType=notification"],
    BAD_MESSAGE_NOT_SIGNED: [405, "Not signed"],
    BAD_MESSAGE_NOT_ID: [406, "Not id"],
    BAD_MESSAGE_NOT_SIGNED: [407, "Body too big"],
    BAD_MESSAGE_BAD_SIGNATURE: [408, "Bad signature, dropping notification"]
  },
  UAWS: {
    BAD_MESSAGE_NOT_RECOGNIZED: [404, "messageType not recognized for this HTTP API"]
  }
}