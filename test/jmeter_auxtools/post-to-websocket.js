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
        var uatoken = null;
        try {
          uatoken = JSON.parse(fullBody).uatoken || JSON.parse(fullBody).data.uatoken;
        } catch(e) {
          console.log('no se puede parsear la petición');
          return res.end('no se puede parsear la petición');
        }
        websocket(uatoken, fullBody, function(salida) {
          console.log("salida para post --> " + salida);
          res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
          return res.end(salida);
        });
        return;
      });
    } else {
      res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
      res.write("Petition in /websocket not a POST");
      return res.end();
    }
  }
  else {
    res.writeHead(200, {'Content-Type': 'text/plain', 'access-control-allow-origin': '*'});
    res.write("Malformed petition");
    return res.end();
  }
}

var connectionTable = {};
var connectionsText = {};

function websocket(uatoken, text, callback) {
  if (!connectionsText[uatoken]) connectionsText[uatoken] = '';
  var messageType = '';
  try {
    messageType = JSON.parse(text).messageType;
  } catch(e) {
    console.log('no se puede parsear respuesta de websocket');
  }
  if (messageType == 'getAllMessages') {
    console.log('Getting getAllMessages for the connection of the ua ' + uatoken);
    var ret = connectionsText[uatoken];
    connectionsText[uatoken] = '';
    return callback(ret);
  }
  console.log('Buscando conexión para uatoken=' + uatoken);
  var connection = connectionTable[uatoken];
  if (!connection) {
    console.log('Creating a new client…');

    var WebSocketClient = require('websocket').client;
    connectionTable[uatoken] = new WebSocketClient();
    client = connectionTable[uatoken];
    client.on('connectFailed', function(error) {
      console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function(connection) {
      connectionTable[uatoken] = connection;
      console.log('WebSocket client connected');
      connectionTable[uatoken].on('error', function(error) {
        console.log("Connection Error: " + error.toString());
      });
      connectionTable[uatoken].on('close', function() {
        console.log('push-notification Connection Closed');
        connectionTable[uatoken] = null;
      });
      connectionTable[uatoken].on('message', function(message) {
        if (message.type === 'utf8') {
          console.log("Received: '" + message.utf8Data + "'");
          //connectionTable[uatoken].close();
          connectionsText[uatoken] += message.utf8Data;
          callback(message.utf8Data);
        }
      });

      if (connectionTable[uatoken].connected) {
        connectionTable[uatoken].sendUTF(text);
      }
    });
    client.connect('ws://localhost:8080/', 'push-notification');
  } else {
    console.log('Ya teníamos cliente, lo enviamos por ahí');
    connection.sendUTF(text);
  }
}

function parseURL(url) {
  var urlparser = require('url');
  return urlparser.parse(url);
}