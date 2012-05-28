/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var uuid = require("node-uuid");

function token() {};

token.prototype = {
  // The node token shall be unique
  getToken: function() {
    // TODO: Verify the token is not used
    return uuid.v1();
  }
}

exports token: token;
