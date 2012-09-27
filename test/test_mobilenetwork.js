/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mn = require("../src/common/mobilenetwork.js");

function start_tests() {
  console.log("[Test MobileNetwork] Starting");

  setTimeout(test1, 10);
  setTimeout(test2, 1000);
  setTimeout(test3, 5000);
  setTimeout(test4, 10000);
  setTimeout(test5, 15000);
  setTimeout(test6, 20000);
  setTimeout(test7, 25000);
  setTimeout(test8, 30000);
  setTimeout(test9, 35000);
  setTimeout(test10, 40000);
  setTimeout(test11, 45000);
  setTimeout(test12, 50000);

  setTimeout(function() {
    console.log("[Test MobileNetwork] Finished");
    process.exit();
  }, 55000);
}

function result(d) {
  console.log("[Test MobileNetwork]: Recovered: " + JSON.stringify(d));
}

function test1() {
  console.log("[Test MobileNetwork]: 1.- Recovering movistar españa from database");
  mn.getNetwork("214","07", result);
}

function test2() {
  console.log("[Test MobileNetwork]: 2.- Recovering movistar españa from cache");
  mn.getNetwork("214","07", result);
}

function test3() {
  console.log("[Test MobileNetwork]: 3.- Reseting cache");
  mn.resetCache();
}

function test4() {
  console.log("[Test MobileNetwork]: 4.- Recovering movistar españa from database");
  mn.getNetwork("214","07", result);
}

function test5() {
  console.log("[Test MobileNetwork]: 5.- Recovering movistar españa from cache");
  mn.getNetwork("214","07", result);
}

function test6() {
  console.log("[Test MobileNetwork]: 6.- Recovering movistar españa from database");
  mn.getNetwork("214","07", result);
}

function test7() {
  console.log("[Test MobileNetwork]: 7.- Recovering Xfera from database");
  mn.getNetwork("214","04", result);
}

function test8() {
  console.log("[Test MobileNetwork]: 8.- Recovering Xfera from cache");
  mn.getNetwork("214","04", result);
}

function test9() {
  console.log("[Test MobileNetwork]: 9.- Recovering non existing network");
  mn.getNetwork("999","99", result);
}

function test10() {
  console.log("[Test MobileNetwork]: 10.- Recovering telefonica españa with number parameters (testing padding)");
  mn.getNetwork(214, 7, result);
}

function test11() {
  console.log("[Test MobileNetwork]: 11.- Calling without callback (telefonica españa)");
  mn.getNetwork("214", "07");
}

function test12() {
  console.log("[Test MobileNetwork]: 12.- Calling without callback (non-existing network)");
  mn.getNetwork("999", "99");
}

start_tests();
