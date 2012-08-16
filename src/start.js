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
    max: 1,
    killTree: true,
    silent: false
  });
  started[child].start();
  started[child].on('exit', function() {
    console.warn(child + ' has closed after 1 restart, check the logs!');
  });
});

function closeChilds() {
  started.forEach(function(child) {
    child.exit();
  });

  setInterval(function() {
    process.exit();
  }, 2000);
}

process.on('SIGTERM', closeChilds);
process.on('SIGINT', closeChilds);