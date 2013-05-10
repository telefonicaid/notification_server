/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

function counters() {
  this._counters = {};
}

counters.prototype = {
  get: function(c) {
    return this._counters[c] || 0;
  },

  set: function(c,val) {
    return this._counters[c] = val;
  },

  inc: function(c) {
    return this._counters[c] = this.get(c) + 1;
  },

  dec: function(c) {
    return this._counters[c] = this.get(c) - 1;
  }
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var c = new counters();
function getCounters() {
  return c;
}

module.exports = getCounters();
