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
    if (!this._counters[c])
      return 0;
    return this._counters[c];
  },

  set: function(c,val) {
    this._counters[c] = val;
    return this.get(c);
  },

  inc: function(c) {
    this._counters[c] = this.get(c) + 1;
    return this.get(c);
  },

  dec: function(c) {
    this._counters[c] = this.get(c) - 1;
    return this.get(c);
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
