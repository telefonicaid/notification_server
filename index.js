
/////////////////////////////////
// Configuration
/////////////////////////////////

const NS_INTERNAL_BIND_IP = "127.0.0.1";
const NS_INTERNAL_PORT = 8080;
const NS_EXTERNAL_BIND_IP = "127.0.0.1";
const NS_EXTERNAL_PORT = 8081;
const NS_EXTERNAL_BASE_URL = "http://localhost";

/////////////////////////////////
// Server Class
/////////////////////////////////

function server(ip, port) {
  this.ip = ip;
  this.port = port;
}

server.prototype = {
  init: function init(obj,onrequest) {
    // Create the server
    var http = require('http');
    this.server = http.createServer(onrequest.bind(obj)).
                  listen(this.port, this.ip);
    console.log('HTTP server running on ' + this.ip + ":" + this.port);
  }
}

/////////////////////////////////
// Main proccess
/////////////////////////////////

function main() {
  this.int_server = new server(NS_INTERNAL_BIND_IP, NS_INTERNAL_PORT);
  this.ext_server = new server(NS_EXTERNAL_BIND_IP, NS_EXTERNAL_PORT);
}

main.prototype = {
  start: function start() {
    this.int_server.init(this,this.onintserverRequest);
    this.ext_server.init(this,this.onextserverRequest);
    this.handsetsTable = new handsets();
  },

  onintserverRequest: function onintserverRequest(req, res) {
    var params = this.parseURL(req.url);
    console.log("internal server: " + JSON.stringify(params));

    // Internal server only accepts "register" requests
    if(!params.command == "register") {
      this.prepareErrorResponse("error, command not accepted");
      return;
    }

    this.handsetsTable.register(req.connection.remoteAddress, params.token);
    var msg = "REGISTERED&" + NS_EXTERNAL_BASE_URL + ":" + NS_EXTERNAL_PORT +
              "/notify/" + params.token;
    this.prepareOkResponse(res,msg);
  },

  onextserverRequest: function onextserverRequest(req, res) {
    var params = this.parseURL(req.url);
    console.log("external server: " + JSON.stringify(params));

    // External server only accepts "notify" requests
    if(!params.command == "notify") {
      this.prepareErrorResponse(res, "error, command not accepted");
      return;
    }

    // Verify origin
    if(!this.verifyOrigin(req.connection.remoteAddress)) {
      console.log("Bad origin " + req.connection.remoteAddress);
      return;
    }

    // Locate handset IP address
    var ip = this.handsetsTable.locateByToken(params.token);
    if(!ip) {
      console.log("IP not located. Token: " + params.token);
      this.prepareErrorResponse(res, "error, token not registered");
      return;
    }

    console.log("Located IP associated to Token " + params.token + " = " + ip);

    // When the data payload arrives, we'll process the petition
    req.on("data", function(data) {
      this.prepareOkResponse(res,"Data to IP: " + ip + " = " + data);

      // Notify handset
      this.notifyHandset(ip, req.connection.remoteAddress, data);
    }.bind(this));
  },

  parseURL: function parseURL(url) {
    var urlparser = require('url');
    var data = {};
    data.parsedURL = urlparser.parse(url, true);
    var path = data.parsedURL.pathname.split("/");
    data.command = path[1];
    if(path.length > 2) {
      data.token = path[2];
    } else {
      data.token = data.parsedURL.query.token;
    }
    return data;
  },

  prepareOkResponse: function prepareOkResponse(res, msg) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(msg);
    res.end();
  },

  prepareErrorResponse: function prepareErrorResponse(res, msg) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end(msg);
  },

  verifyOrigin: function verifyOrigin(ip) {
    // TODO: Verify origin
    console.log("Verify origin: " + ip);
    return true;
  },

  notifyHandset: function notifyHandset(ip, origin, data) {
    // TODO: Notify the hanset with the associated Data
    console.log("Notifiy from " + origin + " -> " + data + " to " + ip);
  }
}

/////////////////////////////////
// Hash table class
/////////////////////////////////

function handsets() {
  this.tokensTable = {};
  this.ipsTable = {};
}

handsets.prototype = {
  register: function register(ip, token) {
    // First we shall verify the IP is not used
    if(this.ipsTable[ip]) {
      // Delete old token
      console.log("Deleting old token for IP " + ip +
                  " = " + this.tokensTable[this.ipsTable[ip]]);
      delete(this.tokensTable[this.ipsTable[ip]]);
      delete(this.ipsTable[ip]);
    }
    // Register new token/ip
    this.tokensTable[token] = ip;
    this.ipsTable[ip] = token;
    console.log("Registered: " + ip + " # " + token);
  },

  locateByToken: function locateByToken(token) {
    return this.tokensTable[token];
  }
}

/////////////////////////////////
// Run the server
/////////////////////////////////

var m = new main();
m.start();

