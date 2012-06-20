/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('./config.js');
var protocol = require('./ns_as/net_protocol.js').networkProtocol;

function main() {
  this.servers = [];
}

main.prototype = {
  start: function() {
    // Start servers
    for(a in config.ifaces) {
      this.servers[a] = new protocol(config.ifaces[a].iface, config.ifaces[a].port);
      this.servers[a].init();
    }
  }
}

/////////////////////////
// Run the server
/////////////////////////

var m = new main();
m.start();
