/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

function main() {
}

main.prototype = {
  start: function() {
    // Import logger
    var log = require("./common/logger.js").getLogger;
    // Look for what server type we are running
    var server = process.argv[2];
    //And start what is needed
    switch(server) {
      case "NS_UA_WS":
        log.init("/tmp/push-NS_UA_WS.log", "NS_UA_WS", 1);
        log.info("Starting as NS_UA_WS server");
        break;
      case "NS_UA_SMS":
        log.init("/tmp/push-NS_UA_SMS.log", "NS_UA_SMS", 1);
        log.info("Starting NS_UA_SMS server");
        break;
      case "NS_UA_UDP":
        log.init("/tmp/push-NS_UA_UDP.log", "NS_UA_UDP", 1);
        log.info("Starting NS_UA_UDP server");
        break;
      case "NS_AS":
        log.init("/tmp/push-NS_AS.log", "NS_AS", 1);
        log.info("Starting NS_AS server");
        var sel = require('./ns_as/start.js');
        this.server = new sel.NS_AS_main();
        this.server.start();
        break;
      case "NS_MSG_monitor":
        log.init("/tmp/push-NS_MSG_monitor.log", "NS_MSG_monitor", 1);
        log.info("Starting NS_MSG_monitor server");
        break;
      default:
        log.init("/tmp/push.log", "PUSH", 1);
        log.error("No server provided");
        printInfo();
    }
  }
};

function printInfo() {
  console.log("No server selected, please start with node main.js [TYPE]. RTFD.");
}

/////////////////////////
// Run the server
/////////////////////////
var m = new main();
m.start();
