/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var config = require('../config.js').NS_AS;

function NS_AS_main() {
	this.servers = [];
	//common/logger.js -> //l.getLogger()
						  //l.init(fichero, nombre, consoleoutput)
}

NS_AS_main.prototype = {
	start: function() {
		var protocol = require('./net_protocol.js').networkProtocol;
		// Start servers
    	for(a in config.ifaces) {
    		this.servers[a] = new protocol(config.ifaces[a].iface, config.ifaces[a].port);
        	this.servers[a].init();
   		}
   		var log = require("../common/logger.js").getLogger;
        log.info("NS_AS server initialized");
	}
}

exports.NS_AS_main = NS_AS_main;