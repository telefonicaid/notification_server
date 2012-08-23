var WebSocketServer = require('websocket').server;
var http = require('http');

http.createServer(onHTTPMessage).listen(8888, "0.0.0.0");
console.log('post-to-websocket --> Listening on 0.0.0.0:8888');

function onHTTPMessage(req, res) {
  console.log('post-to-websocket --> Received request for ' + req.url);
  if(req.url == "/websocket") {
    console.log("Petition accepted in /websocket");
    if (req.method == 'POST') {
     var fullBody = '';
     req.on('data', function(chunk) {
      fullBody += chunk.toString();
    });
     req.on('end', function() {
       websocket(fullBody, function(salida) {
        console.log("salida para post --> " + salida);
        res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
        res.end(salida);
      });
     });
   } else {
    res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
    res.write("Petition in /websocket not a POST");
    res.end();
  }
}
else {
  res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
  res.write("Malformed petition");
  res.end();
}
}

function websocket(text, callback) {
  console.log("Initiating websocket");
  var WebSocketClient = require('websocket').client;

  var client = new WebSocketClient();

  client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
  });

  client.on('connect', function(connection) {
    console.log('WebSocket client connected');
    connection.on('error', function(error) {
      console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
      console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        console.log("Received: '" + message.utf8Data + "'");
        callback(message.utf8Data);
      }
    });

    if (connection.connected) {
     connection.sendUTF(text);
   }
 });

  client.connect('ws://localhost:8080/', 'push-notification');
}

function parseURL(url) {
  var urlparser = require('url');
  return urlparser.parse(url);
}