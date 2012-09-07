/**
 * PUSH Notification server V 0.3
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var forever = require('forever-monitor'),
    starts = require("./config.js").servers;

// Show license
console.log(
"    PUSH Notification Server \n\
    Copyright (C) 2012  Telefonica PDI \n\
 \n\
    This program is free software: you can redistribute it and/or modify \n\
    it under the terms of the GNU Affero General Public License as published by \n\
    the Free Software Foundation, either version 3 of the License, or \n\
    (at your option) any later version. \n\
 \n\
    This program is distributed in the hope that it will be useful, \n\
    but WITHOUT ANY WARRANTY; without even the implied warranty of \n\
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the \n\
    GNU Affero General Public License for more details. \n\
 \n\
    You should have received a copy of the GNU Affero General Public License \n\
    along with this program.  If not, see <http://www.gnu.org/licenses/>. \n\
\n\n\n\n");

//Fill what server should be started
var childs = [];
(function fillChilds() {
  for (var i in starts) {
    if (starts[i]) childs.push(i);
  }
})();
starts = childs;

//Start servers and keep a reference for each of them
var started = new Array(childs.length);
starts.forEach(function(child) {
  console.log(child);
  started[child] = new (forever.Monitor)(['node', 'main.js', child], {
    max: 1,
    killTree: true,
    silent: false
  });
  started[child].start();
  started[child].on('exit', function() {
    console.warn(child + ' has closed!');
  });
  console.log('asdfasdfasdf' + started.length);
});

function closeChilds() {
  console.log('Kill signal on start.js -->' + started);
  started.forEach(function(child, index, started) {
    //Send the exit signal to childs (SIGINT)
    console.log('Sending signal to ' + child);
    child.exit();
  });

  //Wait for a safe time to close this parent.
  //This should be enough to every child to close correctly
  setInterval(function() {
    console.log('Exiting monitor. Thanks for playing');
    process.exit();
  }, 5000);
}

process.on('SIGTERM', closeChilds);
process.on('SIGINT', closeChilds);
process.on('SIGKILL', closeChilds);