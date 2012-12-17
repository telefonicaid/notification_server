/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var a = 0;

function sendNotification() {
    var http = require("http");
    var options = {
      host: "localhost",//owd-push-qa-fe1.hi.inet",
      port: 8081,
      path: "/notify/b578c949551625b05bcac73fb81a9d8bf9272bb0c2a47ff8f7bc6b8bb44554ef",
      method: 'POST'
    };

    var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        //console.log(chunk);
        if ((++a % 100) === 0) {
          console.log("Enviadas " + a + " peticiones");
        }
      });
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    // write data to request body
    req.write('{"messageType":"notification","id":1234,"message":"Hola","signature":"","ttl":0,"timestamp":"SINCE_EPOCH_TIME","priority":1}');
    req.end();
}

for (var i = 100000 - 1; i >= 0; i--) {
  sendNotification();
};

function onClose() {
  console.log("Hemos enviado " + a + "notificaciones. Comprueba la cola de newMessages y Mongo");
  process.exit(1);
}

process.on('SIGINT', onClose);