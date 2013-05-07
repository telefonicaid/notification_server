#!/usr/bin/env node

var lt = require("../src/common/logtraces.js").logtraces;

if (!process.argv[2]) {
  console.log('Please, specify a log ID as:');
  console.log(' ' + process.argv[1] + ' 0x1234');
  return;
}

Object.keys(lt).forEach(function(k) {
  if (lt[k].id == process.argv[2]) {
    console.log(' * Log trace - ' + k);
    console.log(' * ID: 0x' + lt[k].id.toString(16));
    console.log(' * Message: ' + lt[k].m);
    if (lt[k].doc) {
      console.log(' * Documentation: ' + lt[k].doc);
    }
    process.exit();
  }
});

console.log(' * Sorry, I didn\'t locate the log trace ID :(');
