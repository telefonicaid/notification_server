/**
 * Register UA test
 * This executes 1000 HTTP petitions to get different tokens.
 * And then register each token with a Websocket connection
 * @see the common library helper
 */

var common = require('./common.js');
var debug = common.debug;

var id = setInterval(function() {
  common.getToken(function(err, data) {
    //If we have an error or we don't have data, exit with error
    if (err || !data) {
      process.exit(1);
    }

    /// XXXX: add content
    common.registerUA(data, connection, registerUAresponse);


    //If we have 1000 tokens, finish the test
    if (++times == 1000) {
      clearInterval(id);
      finishTest();
    }
  });
}, 0);

function registerUAresponseOK(token, statuscode, response) {
  if (statuscode != '200') {
    console.log('registerUA::registerUAresponseOK --> Got a ' + statuscode + ' status code, should be 200, uatoken=' + token);
    process.exit(1);
  }
  if (response != )
}