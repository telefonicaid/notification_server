
/////////////////////////////////
// Configuration
/////////////////////////////////

const NS_INTERNAL_IP = "127.0.0.1";
const NS_INTERNAL_PORT = 8080;
const NS_EXTERNAL_IP = "127.0.0.1";
const NS_EXTERNAL_PORT = 8081;

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
  this.int_server = new server(NS_INTERNAL_IP, NS_INTERNAL_PORT);
  this.ext_server = new server(NS_EXTERNAL_IP, NS_EXTERNAL_PORT);
}

main.prototype = {
  start: function start() {
    this.int_server.init(this,this.onintserverRequest);
    this.ext_server.init(this,this.onextserverRequest);
  },

  onintserverRequest: function onintserverRequest(req, res) {
    var params = this.commonRequest(req, res);
    console.log("internal server: " + JSON.stringify(params));
  },

  onextserverRequest: function onextserverRequest(req, res) {
    var params = this.commonRequest(req, res);
    console.log("external server: " + JSON.stringify(params));
  },

  commonRequest: function commonRequest(req, res) {
    this.writeHeaders(res);
    return this.parseURL(req.url);
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

  writeHeaders: function writeHeaders(res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
  }
}

/////////////////////////////////
// Run the server
/////////////////////////////////

var m = new main();
m.start();

