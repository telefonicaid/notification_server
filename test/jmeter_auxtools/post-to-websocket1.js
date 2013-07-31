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
        var idTest = null;
        try {
          idTest = JSON.parse(fullBody).idTest || JSON.parse(fullBody).data.idTest;
        } catch(e) {
          console.log('no se puede parsear la petición');
          return res.end('no se puede parsear la petición');
        }
        websocket(idTest, fullBody, function(salida) {
          console.log("salida para post --> " + salida);
          this.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
          return this.end(salida);
        }.bind(res));
        return;
      });
    } else {
      res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
      res.write("Petition in /websocket not a POST");
      return res.end();
    }
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
    res.write("Malformed petition");
    return res.end();
  }
}

var connectionTable = {};
var connectionsText = {};
var connectionCB = {};

function websocket(idTest, text, callback) {
  if (!connectionsText[idTest]) connectionsText[idTest] = '';
  console.log('Buscando conexión para idTest=' + idTest);
  var connection = connectionTable[idTest];
  if (!connection) {
    console.log('Creating a new client…');

    var WebSocketClient = require('websocket').client;
    connectionTable[idTest] = new WebSocketClient();
    client = connectionTable[idTest];
    client.on('connectFailed', function(error) {
      console.log('Connect Error: ' + error.toString());
    });
    connectionCB[idTest] = callback;

    client.on('connect', function(connection) {
      connectionTable[idTest] = connection;
      console.log('WebSocket client connected');
      connectionTable[idTest].on('error', function(error) {
        console.log("Connection Error: " + error.toString());
      });
      connectionTable[idTest].on('close', function() {
        console.log('push-notification Connection Closed');
        connectionTable[idTest] = null;
      });
      connectionTable[idTest].on('message', function(message) {
        if (message.type === 'utf8') {
          console.log("Received: '" + message.utf8Data + "'");
          //connectionTable[idTest].close();
          connectionsText[idTest] += message.utf8Data;
          connectionCB[idTest](message.utf8Data);
        }
      });

      if (connectionTable[idTest].connected) {
        connectionTable[idTest].sendUTF(text);
      }
    });
    setTimeout(function() {
        client.connect('ws://172.17.0.197:8080/', 'push-notification');
    }, 1);
  } else {
    console.log('Ya teníamos cliente, lo enviamos por ahí');
    connectionCB[idTest] = callback;       // Update callback
    if (!connection) {
      connectionCB[idTest]('ERROR EN EL WEBSOCKET');
      return console.log('Error, no hay conexión websocket');
    }
    connection.sendUTF(text);
  }
}

function parseURL(url) {
  var urlparser = require('url');
  return urlparser.parse(url);
}