/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var fs = require('fs'),
    logparams = require('../config.js').logger,
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
 * # ALARM: When we need to raise a problem. Will be written in a separate file
 */

function logger() {
  this.consoleOutput = logparams.CONSOLEOUTPUT;
  this.logLevel = logparams.LOGLEVEL;
  this.debug('logger::logger --> Logger created but not initialized. Use init(logfile,appname,consoleOutput) method !');
}

logger.prototype = {
  // ANSI Colors (for the console output)
  color_red: '\u001b[0;31m',
  color_RED: '\u001b[1;31m',
  color_green: '\u001b[0;32m',
  color_GREEN: '\u001b[1;32m',
  color_yellow: '\u001b[0;33m',
  color_YELLOW: '\u001b[1;33m',
  color_blue: '\u001b[0;34m',
  color_BLUE: '\u001b[1;34m',
  color_purple: '\u001b[0;35m',
  color_PURPLE: '\u001b[1;35m',
  color_cyan: '\u001b[0;36m',
  color_CYAN: '\u001b[1;36m',
  color_reset: '\u001b[0m',

  init: function(logfile, appname, consoleOutput) {
    this.logfile = fs.createWriteStream(logparams.BASE_PATH + logfile, { flags: 'a', encoding: null, mode: 0644 });
    this.logfilealarm = fs.createWriteStream(logparams.ALARM, { flags: 'a', encoding: null, mode: 0644 });
    this.appname = appname;
    this.consoleOutput = consoleOutput;
    this.log('START', '---------8<---------8<---------8<---------8<---------8<---------8<---------8<---------8<---------8<---------', false);
    this.debug('logger::init --> Logger initialized!');
  },

  log: function(level, message, trace, color, object) {
     // Log disabled
    if (!this.logfile && !this.consoleOutput) {
      return;
    }

    //Disable logging if we have not initialized yet. Useful for tests
    if (!this.appname) {
      return;
    }

    var logmsg = '[' + this.appname + ' # ' + level + '] - {' + (new Date()) + ' (' + Date.now() + ')} - ' + message;
    if (object) {
      logmsg += ' ' + this.color_PURPLE + JSON.stringify(object);
    }

    if (this.logfilealarm && level === 'ALARM') {
      this.logfilealarm.write(logmsg + '\n');
    } else if (this.logfile) {
      this.logfile.write(logmsg + '\n');
    }

    if (this.consoleOutput) {
      console.log(color + logmsg + this.color_reset);
      if (trace) {
        console.trace('logger::log --> Callstack:');
      }
    }
  },

  /**
   * Commodity methods per log level
   */
  critical: function(message, object) {
    if (this.logLevel & loglevel.CRITICAL) {
      this.log('CRITICAL', message, true, this.color_RED, object);
    }
    this.log('CRITICAL', 'WE HAVE A CRITICAL ERROR, WE ARE CLOSING!!!', false, this.color_red);
    // We cannot continue our process, kill it!
    process.exit(1);
  },

  debug: function(message, object) {
    if (this.logLevel & loglevel.DEBUG) {
      this.log('DEBUG', message, false, this.color_cyan, object);
    }
  },

  info: function(message, object) {
    if (this.logLevel & loglevel.INFO) {
      this.log('INFO', message, false, this.color_green, object);
    }
  },

  error: function(message, object) {
    if (this.logLevel & loglevel.ERROR) {
      this.log('ERROR', message, true, this.color_red, object);
    }
  },

  alert: function(message, object) {
    if (this.logLevel & loglevel.ALERT) {
      this.log('ALERT', message, false, this.color_purple, object);
    }
  },

  notify: function(message, object) {
    if (this.logLevel & loglevel.NOTIFY) {
      this.log('NOTIFY', message, false, this.color_yellow, object);
    }
  },

  alarm: function(message, object) {
    if (this.logLevel & loglevel.ALARM) {
      this.log('ALARM', message, true, this.color_RED, object);
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
