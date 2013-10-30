/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var a = 0;

if (process.argv.length < 3) {
  console.log("It's needed the apptoken");
  process.exit();
}

function sendNotification(vers) {
  var https = require("https");
  var options = {
    host: "localhost",//owd-push-qa-fe1.hi.inet",
    port: 8081,
    path: "/v1/notify/" + process.argv[2],
    method: 'PUT',
    rejectUnauthorized: false,
    requestCert: true,
    agent: false
  };
  options.agent = new https.Agent(options);

  var req = https.request(options, function (res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      //console.log(chunk);
      if ((++a % 100) === 0) {
        console.log("Enviadas " + a + " peticiones");
      }
    });
  });
}

req.on('error', function (e) {
  console.log('problem with request: ' + e.message);
});

// write data to request body
req.write('version=' + vers);
req.end();
}

for (var i = 0; i < 100000; i++) {
  sendNotification(i);
}

function onClose() {
  console.log("Hemos enviado " + a + "notificaciones. Comprueba la cola de newMessages y Mongo");
  process.exit(1);
}

process.on('SIGINT', onClose);
