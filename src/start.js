/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var forever = require('forever-monitor'),
    fs = require('fs'),
    starts = require('./config.js').servers;

// Show license
var license = 'PUSH Notification Server \n';
license += 'Copyright (C) 2012  Telefonica PDI \n\n';
license += 'This program is free software: you can redistribute it and/or modify \n';
license += 'it under the terms of the GNU Affero General Public License as published by \n';
license += 'the Free Software Foundation, either version 3 of the License, or \n';
license += '(at your option) any later version. \n';
license += 'This program is distributed in the hope that it will be useful, \n';
license += 'but WITHOUT ANY WARRANTY; without even the implied warranty of \n';
license += 'MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the \n';
license += 'GNU Affero General Public License for more details. \n';
license += 'You should have received a copy of the GNU Affero General Public License \n';
license += 'along with this program.  If not, see <http://www.gnu.org/licenses/>. \n';
license += '\n\n\n\n';

console.log(license);

// Show version
try {
  var version = fs.readFileSync('version.info');
  console.log('PUSH Notification Server Version: ' + version);
} catch (e) {
  console.error('No version.info file, please run make');
}

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
  started[child] = new(forever.Monitor)(['node', 'main.js', child], {
    max: 1,
    killTree: true,
    silent: false
  });
  started[child].start();
  started[child].on('exit', function() {
    console.warn(child + ' has closed!');
  });
});

var closing = false;

function closeChilds() {
  if (closing) {
    return;
  }
  closing = true;
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
