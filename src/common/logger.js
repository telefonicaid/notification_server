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
    this.logfile = fs.createWriteStream(logfile, { flags: 'w', encoding: null, mode: 0666 });
    this.appname = appname;
    this.consoleOutput = consoleOutput;
    this.debug("Logger initialized !");
  },

  log: function (level, message) {
    var logmsg = "[" + this.appname + " # " + level + "] - {" + Date.now() + "} - " + message
    if(this.logfile)
      this.logfile.write(logmsg + "\n");
    if(this.consoleOutput)
      console.log(logmsg);
  },

  debug: function (message) {
    this.log("DEBUG", message);
  },

  info: function (message) {
    this.log("INFO", message);
  },

  error: function (message) {
    this.log("ERROR", message);
  },

  critical: function (message) {
    this.log("CRITICAL", message);
  }
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _logger = new logger();
function getLogger() {
  return _logger;
}
exports.getLogger = new getLogger();
