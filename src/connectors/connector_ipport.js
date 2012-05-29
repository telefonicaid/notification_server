/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

function connector_ipport(data,conn) {
  this.data = data;
  this.connection = conn;
  this.connection.close();
}

connector_ipport.prototype = {
  notify: function(msg) {
    // Notify the hanset with the associated Data
    console.log("Connector IPPort: Notify to " + this.data.iface.ip);

    // Create the HTTP client
    var http = require("http");
    var options = {
      host: this.data.iface.ip,
      port: this.data.iface.port,
      path: "/",
      method: "POST"
    };
    var req = http.request(options, function(res) {
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
      });
    });
    req.on("error", function(e) {
      console.log("Connector IPPort: Error on request: " + e.message);
    });

    req.end("NOTIFY " + msg + "\n");    
  }
}

exports.connector_ipport = connector_ipport;
