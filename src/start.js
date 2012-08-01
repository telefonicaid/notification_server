/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var forever = require('forever-monitor');
var starts = require("./config.js").servers;

//Fill what server should be started
var childs = [];
(function fillChilds() {
  for (var i in starts) {
    if (starts[i]) childs.push(i);
  }
})();
starts = childs;

//Start servers and keep a reference for each of them
var started = [];
starts.forEach(function(child) {
  started[child] = new (forever.Monitor)(['node', 'main.js', child], {
    max: 3,
    silent: false
  });
  started[child].start();
  started[child].on('exit', function() {
    console.log(child + ' has closed after 3 restarts, check the logs!');
  });
});