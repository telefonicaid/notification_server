/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var forever = require('forever-monitor'),
    fs = require('fs'),
    starts = require('./config.js').servers,
    config = require('./config.js'),
    log = require('./common/logger.js');


log.init(config.NS.logfile, 'NS', 1);

// Show license
console.log(
'    PUSH Notification Server \n' +
'    Copyright (C) 2012  Telefonica PDI \n\n' +
'   This program is free software: you can redistribute it and/or modify \n' +
'    it under the terms of the GNU Affero General Public License as published by \n' +
'    the Free Software Foundation, either version 3 of the License, or \n' +
'    (at your option) any later version. \n\n' +
'   This program is distributed in the hope that it will be useful, \n' +
'    but WITHOUT ANY WARRANTY; without even the implied warranty of \n' +
'    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the \n' +
'    GNU Affero General Public License for more details. \n\n' +
'    You should have received a copy of the GNU Affero General Public License \n' +
'    along with this program.  If not, see <http://www.gnu.org/licenses/>. \n\n'
);

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
  started[child] = new (forever.Monitor)(['node', 'main.js', child], {
    max: 1,
    killTree: true,
    silent: false
  });
  started[child].start();
  started[child].on('exit', function() {
    log.info((child + ' has closed!'));
  });
});

var closing = false;
function closeChilds() {
  closing = true;
  if (closing) {
    log.debug('NS::closeChilds --> We were closing, abort this signal');
    return;
  }
  log.debug('NS::closeChilds --> Kill signal on start.js, killing childs');
  started.forEach(function(child) {
    //Send the exit signal to childs (SIGINT)
    child.exit();
  });
  log.info('NS::closeChilds --> Monitor has sent kill signals to every child, let\'s wait 10 seconds to say we are closed');

  //Wait for a safe time to close this parent.
  //This should be enough to every child to close correctly
  setInterval(function() {
    process.exit();
  }, 10000);
}

process.on('SIGTERM', closeChilds);
process.on('SIGINT', closeChilds);
process.on('SIGKILL', closeChilds);
