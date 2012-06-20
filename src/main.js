/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

function main() {
  this.server;
}

main.prototype = {
  start: function() {
    // Look for what server type we are running
    var server = process.argv[2];
    //And start what is needed
    switch(server) {
      case "NS_UA_WS":
        console.log("Starting NS_UA_WS server");
        var sel = require('./ns_as/start.js');
        var server = new sel.NS_AS_main();
        server.start();
        break;
      case "NS_UA_SMS":
        console.log("Starting NS_UA_SMS server");
        break;
      case "NS_UA_UDP":
        console.log("Starting NS_UA_UDP server");
        break;
      case "NS_AS":
        console.log("Starting NS_AS server");
        break;
      case "NS_MSG_monitor":
        console.log("Starting NS_MSG_monitor server");
        break;
      default:
        printInfo();
    }
  }
}

function printInfo() {
  console.log("No server selected, please start with node main.js [TYPE]. RTFD.");
}

/////////////////////////
// Run the server
/////////////////////////
var m = new main();
m.start();
