/**
* |||||||| Flooding time! |||||||||||
* Let's create a lot of websockets connections
* and try to flood the server.
* Invocation:
* $ node script.js <IP> <Port> <Number of conn> <Interval between starts> <Number of chars> <Interval> <Time to kill>
* both intervals are in milliseconds
*/

var wsClient = require('websocket').client;

var ARGS = [];
if (process.argv.length < 9) {
  console.error('You must use 7 parameters, like this');
  console.error('node script.js <IP> <Port> <Number of conn> <Interval between starts> <Number of chars> <Interval> <Time to kill>');
  console.error('all intervals are in milliseconds');
  process.exit(1);
}
for (var i = 2; i<process.argv.length; i++) {
  ARGS.push(process.argv[i]);
}

//Yep, we are using security!
var WSADRESS = 'wss://'+ARGS[0]+':'+ARGS[1]+'/',
    PROTOCOL = 'push-notification';

var MESSAGE = makeRandom(ARGS[4]);

var getConnection = function getConnection(id, callback) {
  console.log('Creando conexion' + id);
  var conn = new wsClient();
  conn.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
  });
  conn.on('connect', function(connection) {
    callback(id, connection);
  });
  conn.connect(WSADRESS, PROTOCOL);
};

var total = 0;
var closed = [];
var getter = setInterval(function() {
  getConnection(total, function(id, conn) {
    console.log('Connection ' + id + ' established');
    conn.on('error', function(error) {
      console.log("Connection Error: " + error.toString());
    });
    conn.on('close', function() {
      closed[id] = true;
      console.log('Connection ' + id + ' closed');
    });
    conn.on('message', function(message) {
      if (message.type === 'utf8') {
        console.log('---> Message received in conn ' + id +' -- ' + message.utf8Data);
      }
    });
    var interval = setInterval(function() {
      if (closed[id]) {
        clearInterval(interval);
        return;
      }
      console.log('Sending payload to conn' + id);
      conn.sendUTF('{ "messageType": "ack", "messageId":"' + MESSAGE + '"}');
    }, ARGS[5]);
  });
  total++;
  if (total == ARGS[2]) {
    clearInterval(getter);
  }
}, ARGS[3]);

/////////////// Helpers ///////////////////
function makeRandom(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < length; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

setTimeout(function killItWithFire() {
  process.exit();
}, ARGS[6]);
