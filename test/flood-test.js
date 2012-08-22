function sendNotification() {
    var http = require("http");
    var options = {
      host: "127.0.0.1",
      port: 8081,
      path: "notify/d5856351bbc14599e687dac105150e8a919b21477f3c00386405228caac1e43a",
      method: 'POST'
    };

    var req = http.request(options, function(res) {
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
      });
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    // write data to request body
    req.write('{"messageType":"notification","id":1234,"message":"Hola","signature":"","ttl":0,"timestamp":"SINCE_EPOCH_TIME","priority":1}');
    req.end();
}

for (var i = 2 - 1; i >= 0; i--) {
  sendNotification();
};