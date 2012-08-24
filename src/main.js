/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

// Import logger
var config = require('./config.js');
var log = require("./common/logger.js");
var os = require("os");

////////////////////////////////////////////////////////////////////////////////
function generateServerId() {
  process.serverId = os.type() + "-" + os.release() + "#" +
                     os.hostname() + "#" + process.pid;
  return process.serverId;
}
////////////////////////////////////////////////////////////////////////////////

function main() {
  var server = null;
}

main.prototype = {
  start: function() {
    // Generate a new server ID
    log.info("Server ID: " + generateServerId());
    var sel;
    // Look for what server type we are running
    // and start what is needed
    switch(process.argv[2]) {
      case "NS_UA_WS":
        log.init(config.NS_UA_WS.logfile, "NS_UA_WS", 1);
        log.info("Starting as NS_UA_WS server");
        sel = require('./ns_ua/ws_main.js');
        this.server = new sel.NS_UA_WS_main();
        this.server.start();
        break;
      case "NS_UA_UDP":
        log.init(config.NS_UA_UDP.logfile, "NS_UA_UDP", 1);
        log.info("Starting as NS_UA_UDP server");
        sel = require('./ns_ua/udp_main.js');
        this.server = new sel.NS_UA_UDP_main();
        this.server.start();
        break;
      case "NS_AS":
        log.init(config.NS_AS.logfile, "NS_AS", 1);
        log.info("Starting NS_AS server");
        sel = require('./ns_as/as_main.js');
        this.server = new sel.NS_AS_main();
        this.server.start();
        break;
      case "NS_MSG_monitor":
        log.init(config.NS_Monitor.logfile, "NS_MSG_monitor", 1);
        log.info("Starting NS_MSG_monitor server");
        sel = require('./ns_msg_mon/msg_mon_main.js');
        this.server = new sel.NS_MSG_MON_main();
        this.server.start();
        break;
      default:
        log.init("/tmp/push.log", "PUSH", 1);
        log.error("No server provided");
    }
  },

  stop: function() {
    log.info('Closing the server correctly');
    this.server.stop();
  }
};

/////////////////////////
// Run the server
/////////////////////////
var m = new main();
m.start();

/////////////////////////
// On close application
function onClose() {
    log.info('Received interruption (2) signal');
    m.stop();
    process.exit(1);
}

function onKill() {
  log.error('Received kill (9 or 15) signal');
  m.stop();
  process.exit(1);
}

process.on('SIGINT', onClose);     // 2
process.on('SIGKILL', onKill);    // 9
process.on('SIGTERM', onKill);    // 15
