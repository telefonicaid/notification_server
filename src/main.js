/* jshint node: true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';

var config = require('./config.js'),
    Log = require('./common/Logger.js'),
    os = require('os');

////////////////////////////////////////////////////////////////////////////////
function generateServerId() {
    process.serverId = os.type() + '-' + os.release() + '#' +
        os.hostname() + '#' + process.pid;
    return process.serverId;
}
////////////////////////////////////////////////////////////////////////////////

function Main() {
    this.server = null;
    this.closing = false;
}

Main.prototype = {
    start: function() {
        // Generate a new server ID
        Log.info('Server ID: ' + generateServerId());
        var sel = null;
        // Look for what server type we are running
        // and start what is needed
        switch (process.argv[2]) {
            case 'NS_UA_WS':
                Log.init(config.NS_UA_WS.logfile, 'NS_UA_WS', 1);
                Log.info('Starting as NS_UA_WS server');
                sel = require('./ns_ua/WS_main.js');
                this.server = new sel.NS_UA_WS();
                this.server.start();
                break;

            case 'NS_UA_UDP':
                Log.init(config.NS_UA_UDP.logfile, 'NS_UA_UDP', 1);
                Log.info('Starting as NS_UA_UDP server');
                sel = require('./ns_ua/UDP_main.js');
                this.server = new sel.NS_UA_UDP();
                this.server.start();
                break;

            case 'NS_AS':
                Log.init(config.NS_AS.logfile, 'NS_AS', 1);
                Log.info('Starting NS_AS server');
                sel = require('./ns_as/main.js');
                this.server = new sel.NS_AS();
                this.server.start();
                break;

            case 'NS_Monitor':
                Log.init(config.NS_Monitor.logfile, 'NS_Monitor', 1);
                Log.info('Starting NS_MSG_monitor server');
                sel = require('./ns_msg_mon/main.js');
                this.server = new sel.NS_Monitor();
                this.server.start();
                break;

            case 'NS_WakeUp_Checker':
                Log.init(config.NS_WakeUp_Checker.logfile, 'NS_WakeUp_Checker', 1);
                Log.info('Starting as NS_WakeUp_Checker server');
                sel = require('./ns_wakeupchecker/main.js');
                this.server = new sel.NS_WakeUp_Checker();
                this.server.start();
                break;

            default:
                Log.init('/tmp/push.log', 'PUSH', 1);
                Log.error(Log.messages.ERROR_NOSERVERPROVIDED);
        }
    },

    stop: function(correctly) {
        Log.info('Closing the server correctly');
        this.server.stop(correctly);
    }
};

/////////////////////////
// Run the server
/////////////////////////
var m = new Main();
m.start();


/////////////////////////
// On close application
function onClose() {
    if (m.closing) {
        return;
    }
    m.closing = true;
    Log.info('Received interruption (2) signal');
    m.stop(true);
}

function onKill() {
    if (m.closing) {
        return;
    }
    m.closing = true;
    Log.error(Log.messages.ERROR_RECVKILLSIGNAL);
    m.stop(true);
}

process.on('SIGINT', onClose); // 2
process.on('SIGTERM', onKill); // 15