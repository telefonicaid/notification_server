/**
 * This testcase tests the notifications. It tries to fuck the server
 * with bad combinations, and our error messages given for that.
 * Without debug mode, this should be as quiet as a mute television
 * enable DEBUG in the common.js file if you want to see more.
 * exists with 0 code if everything is OK, and 1 if there were problems
 */

var common = require('./common'),
    helpers = require('../../src/common/helpers.js');

// We assume that we will pass all tests, because our code is awesome
var valid = 1;

// Notification with malformed json
var url = helpers.getNotificationURL('badNotificationJSONinvalid');
var text = '{"this is a " malformed, JSON, object:, sent, to The server';
common.sendNotification(url, text, function(err, status, body, sentnotification) {
  var correct = 1;
  if (err) {
    console.log('signature::onnotificationsent --> Test 1 - error: ' + err);
    correct = 0;
  }
  if (status != 400) {
    console.log('signature::onnotificationsent --> Test 1 - The status (should be 400) is ' + status);
    correct = 0;
  }
  var expected = '{"status":"ERROR", "reason":"JSON not valid"}';
  if (body != expected) {
    console.log('signature::onnotificationsent --> Test 1 - The body sent is not correct. Was ' + body + ', expected ' + expected);
    correct = 0;
  }
  if (correct === 0) {
    valid = 0;
    return;
  }
  debug('signature::onnotificationsent --> Test 1 - Everything OK');
});

// Notification without the correct messageType
var url = helpers.getNotificationURL('badNotificationMessageType');
var text = '{"messageType": "noRRRRRRtification"}';
common.sendNotification(url, text, function(err, status, body, sentnotification) {
  var correct = 1;
  if (err) {
    console.log('signature::onnotificationsent --> Test 2 - error: ' + err);
    correct = 0;
  }
  if (status != 400) {
    console.log('signature::onnotificationsent --> Test 2 - The status (should be 400) is ' + status);
    correct = 0;
  }
  var expected = '{"status":"ERROR", "reason":"Not messageType=notification"}';
  if (body != expected) {
    console.log('signature::onnotificationsent --> Test 2 - The body sent is not correct. Was ' + body + ', expected ' + expected);
    correct = 0;
  }
  if (correct === 0) {
    valid = 0;
    return;
  }
  debug('signature::onnotificationsent --> Test 2 - Everything OK');
});

// Notification without signature
var url = helpers.getNotificationURL('badNotificationNoSignature');
var text = '{"messageType": "notification"}';
common.sendNotification(url, text, function(err, status, body, sentnotification) {
  var correct = 1;
  if (err) {
    console.log('signature::onnotificationsent --> Test 3 - error: ' + err);
    correct = 0;
  }
  if (status != 400) {
    console.log('signature::onnotificationsent --> Test 3 - The status (should be 400) is ' + status);
    correct = 0;
  }
  var expected = '{"status":"ERROR", "reason":"Not signed"}';
  if (body != expected) {
    console.log('signature::onnotificationsent --> Test 3 - The body sent is not correct. Was ' + body + ', expected ' + expected);
    correct = 0;
  }
  if (correct === 0) {
    valid = 0;
    return;
  }
  debug('signature::onnotificationsent --> Test 3 - Everything OK');
});


/*
 *
 * DISABLING SINCE WE NEED TO HAVE THE WEBAPP REGISTERED PRIOR OF THIS IN THE DDBB
 *
 */

// // Notification without body
// var url = helpers.getNotificationURL('badNotificationNoSignature');
// var text = '{"messageType": "notification", "signature": "blahblah"}';
// common.sendNotification(url, text, function(err, status, body, sentnotification) {
//   var correct = 1;
//   if (err) {
//     console.log('signature::onnotificationsent --> Test 4 - error: ' + err);
//     correct = 0;
//   }
//   if (status != 200) {
//     console.log('signature::onnotificationsent --> Test 4 - The status (should be 200) is ' + status);
//     correct = 0;
//   }
//   var expected = '{"status": "ACCEPTED"}';
//   if (body != expected) {
//     console.log('signature::onnotificationsent --> Test 4 - The body sent is not correct. Was ' + body + ', expected ' + expected);
//     correct = 0;
//   }
//   if (correct === 0) {
//     valid = 0;
//     return;
//   }
//   debug('signature::onnotificationsent --> Test 4 - Everything OK');
// });

// // Full notification
// var url = helpers.getNotificationURL('goodNotification');
// var text = '{"messageType": "notification", "signature": "blahblah", "message": "somemessage"}';
// common.sendNotification(url, text, function(err, status, body, sentnotification) {
//   var correct = 1;
//   if (err) {
//     console.log('signature::onnotificationsent --> Test 5 - error: ' + err);
//     correct = 0;
//   }
//   if (status != 200) {
//     console.log('signature::onnotificationsent --> Test 5 - The status (should be 200) is ' + status);
//     correct = 0;
//   }
//   var expected = '{"status":"ACCEPTED"}';
//   if (body != expected) {
//     console.log('signature::onnotificationsent --> Test 5 - The body sent is not correct. Was ' + body + ', expected ' + expected);
//     correct = 0;
//   }
//   if (correct === 0) {
//     valid = 0;
//     return;
//   }
//   debug('signature::onnotificationsent --> Test 5 - Everything OK');
// });

setTimeout(function checkIfCorrect() {
  if (valid) {
    debug('Everything went OK in all tests');
    process.exit(0);
  } else {
    console.log('There was a problem in one or more tests, check above');
    process.exit(1);
  }
}, 3000);
