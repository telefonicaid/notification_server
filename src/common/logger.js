/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var fs = require('fs'),
    logparams = require("../config.js").logger,
    loglevel = require('./constants.js').loglevels;

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

function logger() {
  this.consoleOutput = logparams.CONSOLEOUTPUT;
  this.logLevel = logparams.LOGLEVEL;
  this.debug("logger::logger --> Logger created but not initialized. Use init(logfile,appname,consoleOutput) method !");
}

logger.prototype = {
  init: function(logfile, appname, consoleOutput) {
    this.logfile = fs.createWriteStream(logparams.BASE_PATH + logfile, { flags: 'a', encoding: null, mode: 0644 });
    this.appname = appname;
    this.consoleOutput = consoleOutput;
    this.log("START", "---------8<---------8<---------8<---------8<---------8<---------8<---------8<---------8<---------8<---------", false);
    this.debug("logger::init --> Logger initialized!");
  },

  log: function(level, message, trace) {
    var logmsg = "[" + this.appname + " # " + level + "] - {" + (new Date()) + " (" + Date.now() + ")} - " + message;
    if(this.logfile)
      this.logfile.write(logmsg + "\n");
    if(this.consoleOutput) {
      console.log(logmsg);
      if(trace) {
        console.trace("logger::log --> Callstack:");
      }
    }
  },

  /**
   * Commodity methods per log level
   */
  critical: function(message) {
    if (this.logLevel & loglevel.CRITICAL) {
      this.log("CRITICAL", message, true);
    }
    this.log("CRITICAL", "WE HAVE A CRITICAL ERROR, WE ARE CLOSING!!!", false);
    // We cannot continue our process, kill it!
    process.exit(1);
  },

  debug: function(message) {
    if (this.logLevel & loglevel.DEBUG) {
      this.log("DEBUG", message, false);
    }
  },

  info: function(message) {
    if (this.logLevel & loglevel.INFO) {
      this.log("INFO", message, false);
    }
  },

  error: function(message) {
    if (this.logLevel & loglevel.ERROR) {
      this.log("ERROR", message, true);
    }
  },

  alert: function(message) {
    if (this.logLevel & loglevel.ALERT) {
      this.log("ALERT", message, true);
    }
  },

  notify: function(message) {
    if (this.logLevel & loglevel.NOTIFY) {
      this.log("NOTIFY", message, true);
    }
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _logger = new logger();
function getLogger() {
  return _logger;
}

module.exports = getLogger();
