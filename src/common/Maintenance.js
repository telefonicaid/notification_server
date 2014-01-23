/* jshint node:true */
/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

'use strict';


var log = require('./Logger.js');

function Maintenance() {
    this.enabled = false;
}

Maintenance.prototype = {
    set: function() {
        log.debug('Setting under Maintenance');
        this.enabled = true;
    },

    unset: function() {
        log.debug('Removing under Maintenance');
        this.enabled = false;
    },

    getStatus: function() {
        return this.enabled;
    }
};

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var _maintenance = new Maintenance();

function getMaintenance() {
    return _maintenance;
}

///////////////////////////////////////////
// Manage maintenance status with signals
///////////////////////////////////////////
// process.on('SIGUSR1', function() {
//   getMaintenance().set();
// });
// process.on('SIGUSR2', function() {
//   getMaintenance().unset();
// });

module.exports = getMaintenance();