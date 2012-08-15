// var assert = require('assert'),
//     vows = require('vows'),
//     onNewPushMessage = require("../src/ns_as/as_server.js").onNewPushMessage;

// function createNotification(id, message, signature, ttl, timestamp, priority) {
//   return '{"messageType": "notification", "id": "' + id + '", "message":"' + message + '", "signature":"' + signature + '", "ttl":' + ttl + ', "timestamp":"' + timestamp + '", "priority":"' + priority +'"}';
// }

// /*************************** Notifications **************************/
// //ID numeric, no space message
// var not_corr_1 = createNotification(1234, "Hola1", "", 1234, 123, 1);
// //ID as alphanumeric, null ttl
// var not_corr_2 = createNotification("abc1234", "Hola hola", null, 1, 1);
// //Strange characters on id and message
// var not_corr_3 = createNotification("+`´´+`'123¡'''ª--ç.{  ´|@#∫∑åå∑", "+`´´+`'123¡'''ª--ç.{  ´|@#∫∑åå∑", null, null, null);
// var incorrect =[
//   //messageType is invalid
//   '{"messageType": "je suis a notification", "id": 1234, "message": "Hola", "signature": "", "ttl": 0, "timestamp": "SINCE_EPOCH_TIME", "priority": 1}',
//   //there is no id
//   '{"messageType": "notification", "id": "", "message": "Hola", "signature": "", "ttl": 0, "timestamp": "SINCE_EPOCH_TIME", "priority": 1}',
//   //Completely malformed
//   'Hey, ho! Let\'s go!'
// ];
// var signed = [
//   //[url, notification],
//   []
// ];

// function getResponse() {
//   var ret = {};
//   onNewPushMessage(not_corr_3,
//                    "",
//                    function callback(text, code) {
//                       ret.text = text;
//                       ret.code = code;
//                    }
//   );
//   return ret;
// }

// // TESTS //
// vows.describe('Notification tests').addBatch({
//   /**
//    * Test to ask for a token. Check length
//    */
//   'Notification 1': {
//     topic: getResponse(not_corr_1),
//     'response should have a {"status": "ACCEPTED"} response': function(topic) {
//       assert.equal(topic.text, '{"status": "ACCEPTED"}');
//     },
//     'response should have a 200 header': function(topic) {
//       assert.equal(topic.code, 200);
//     }
//   },
//   'Notification 2': {
//     topic: getResponse(not_corr_2),
//     'response should have a {"status": "ACCEPTED"} response': function(topic) {
//       assert.equal(topic.text, '{"status": "ACCEPTED"}');
//     },
//     'response should have a 200 header': function(topic) {
//       assert.equal(topic.code, 200);
//     }
//   },
//   'Notification 3': {
//     topic: getResponse(not_corr_3),
//     'response should have a {"status": "ACCEPTED"} response': function(topic) {
//       assert.equal(topic.text, '{"status": "ACCEPTED"}');
//     },
//     'response should have a 200 header': function(topic) {
//       assert.equal(topic.code, 200);
//     }
//   }
// }).export(module);
