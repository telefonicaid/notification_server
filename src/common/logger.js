/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var fs = require('fs');

function logger() {
  this.consoleOutput = true;
  this.debug("Logger created but not initialized. Use init(logfile,appname,consoleOutput) method !");
}

logger.prototype = {
  init: function (logfile, appname, consoleOutput) {
    // use {'flags': 'a'} to append and {'flags': 'w'} to erase and write a new file
    this.logfile = fs.createWriteStream(logfile, { flags: 'w', encoding: null, mode: 0666 });
    this.appname = appname;
    this.consoleOutput = consoleOutput;
    this.debug("Logger initialized !");
  },

  log: function (level, message, trace) {
    var logmsg = "[" + this.appname + " # " + level + "] - {" + (new Date()) + " (" + Date.now() + ")} - " + message;
    if(this.logfile)
      this.logfile.write(logmsg + "\n");
    if(this.consoleOutput) {
      console.log(logmsg);
      if(trace) {
        console.trace("Callstack");
      }
    }
  },

  debug: function (message) {
    this.log("DEBUG", message, false);
  },

  info: function (message) {
    this.log("INFO", message, false);
  },

  error: function (message) {
    this.log("ERROR", message, true);
  },

  critical: function (message) {
    this.log("CRITICAL", message, true);
  }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _logger = new logger();
function getLogger() {
  return _logger;
}
exports.getLogger = new getLogger();
