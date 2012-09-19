/**
 * Get Token test
 * This executes 1000 HTTP petitions to get different tokens.
 * Clones the behaviour of the unit test, but with HTTP requests
 * @see the common library helper
 */

var common = require('./common.js');
var debug = common.debug;

var times = 0;
var tokens = [];
var id = setInterval(function() {
  common.getToken(function(err, data) {
    //If we have an error or we don't have data, exit with error
    if (err || !data) {
      process.exit(1);
    }
    //If we have 1000 tokens, finish the test
    if (++times == 1000) {
      clearInterval(id);
      tokens.push(data);
      finishTest();
    }
    //Add all the tokens!
    tokens.push(data);
  });
}, 0);

function finishTest() {
  if (!common.allDifferents(tokens) || tokens.length != 1000) {
    debug('KO. Oops, there are at least 2 equal tokens, this is bad. Length=' + tokens.length);
    process.exit(1);
  } else {
    debug('OK, length=' + tokens.length);
    process.exit(0);
  }
}
