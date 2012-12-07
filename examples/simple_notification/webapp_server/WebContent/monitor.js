var host = "localhost:8888";
var ws = null;
var clients = [];

function connect() {
  var URL = 'ws://' + host + '/ApplicationServer/monitor';
  if ('WebSocket' in window) {
    ws = new WebSocket(URL);
  } else if ('MozWebSocket' in window) {
    ws = new MozWebSocket(URL);
  } else {
    alert('Your browser do not support WebSockets');
    return;
  }

  ws.onopen = function () {};

  ws.onmessage = function (event) {
    var message = null;
    try {
      message = JSON.parse(event.data);
    } catch(err) {
      alert("Message recieved error: invalid JSON format");
      return;
    }

    if(message.type == 'init') {
      clients = message.data;
      for(var client in clients)
        addClient(clients[client]);
    }

    if(message.type == 'new') {
      var data = message.data;
      for(var client in clients) {
        if(clients[client] == data) {
          alert("New URL received, but it is already registered.");
          return;
        }
      }

      clients.push(data);
      addClient(data);
    }

    if(message.type == 'notifyResponse') {
      document.getElementById("send").style.visibility = 'hidden';
      if(message.error)
        alert(message.error);
    }
  };

  ws.onclose = function () {
    alert('Connection closed');
  };

  ws.onerror = function (event) {
    alert('Error connecting to server');
  };
}

function addClient(url) {
  var table = document.getElementById("panel");

  var rowCount = table.rows.length;
  var row = table.insertRow(rowCount);

  var cell1 = row.insertCell(0);
  cell1.innerHTML = rowCount;

  var cell2 = row.insertCell(1);
  cell2.innerHTML = url;

  var cell3 = row.insertCell(2);
  var input = document.createElement("input");
  input.type = "text";
  input.style.width = "95%";
  cell3.appendChild(input);

  var cell4 = row.insertCell(3);
  var button = document.createElement("input");
  button.type = "button";
  button.value = "Send Notification";
  button.onclick = function() {
    if(input.value == '') {
      alert("Error, empty message");
      return;
    }

    document.getElementById("send").style.visibility = 'visible';
    var message = {type: "notify",
                   url:   url,
                   data:  input.value};
    if(ws != null) {
      ws.send(JSON.stringify(message));
    }
  };

  cell4.appendChild(button);
}

function disconnect() {
  if (ws != null) {
    ws.close();
    ws = null;
  }
}

function sendMessage(message) {
  if (ws != null) {
    ws.send(message);
  }
}
