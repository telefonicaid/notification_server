'use strict';

var DEBUG = true;
var DB_NAME = 'push_app_db';
var STORE_NAME = 'push_app_store';

function debug(msg) {
  if (!DEBUG)
    return;
  //console.log('[DEBUG] PushApp: ' + msg);
  dump('[DEBUG] PushApp: ' + msg + '\n');
}

var Push = {

  init: function() {

    this.clearButton = document.getElementById('buttonClear');
    this.clearButton.addEventListener('click', function(){
      navigator.mozPush.getCurrentURL();
    });

    navigator.mozApps.getSelf().onsuccess = function getSelfCB(evt) {
      var app = evt.target.result;
      app.launch('settings');
    };

    debug("Init");
    this.waurl = "http://192.168.43.252:8888";
    this.watoken = null;
    this.pbk = null;

    this.indexedDB = window.mozIndexedDB || window.webkitIndexedDB || window.indexedDB;
    this.database;

    this.registerAppButton = document.getElementById('buttonRegisterApp');
    this.getURLButton = document.getElementById('buttonGetURL');
    this.clearButton = document.getElementById('buttonClear');
    this.logArea = document.getElementById('logarea');

    try {
      // Register for messaging
      var self = this
      navigator.mozSetMessageHandler("push-notification", function(msg) {
        debug("New Message: " + JSON.stringify(msg));
        self.logMessage(JSON.stringify(msg));

          try {
            var activity = new MozActivity({
              name: 'notify',
              data: {
                type: 'webpush/push'
              }
            });
          } catch (e) {
            debug('WebActivities unavailable? : ' + e);
          }
      });
    } catch(e) {
      debug("This platform does not support system messages.");
    }

    this.initStore(function (success, error){
      if (success) {
        this.watoken = success.watoken;
        this.pbk = success.pbk;
      }

      debug("watoken: " + this.watoken);
      debug("pbk: " + this.pbk);

      if (!this.watoken || !this.pbk) {
        // Request watoken & public key to application server
        debug("Request watoken and public key to app server");
        var url = this.waurl + '/ApplicationServer/register';
        var self = this;
        this.requestToApplicationServer(url, function(success, error){
          if (error) {
            debug(error);
          } else {
            var response = JSON.parse(success);
            self.saveData(response.key, response.watoken, function(){
              self.watoken = response.watoken;
              self.pbk = response.key;
              debug("watoken: " + self.watoken);
              debug("pbk: " + self.pbk);
              self.requestURL();
            });
          }
        });
      } else {
        this.requestURL();
      }
    }.bind(this));
  },

  requestURL: function() {
    var self = this;
    var req = navigator.mozPush.requestURL(this.watoken, this.pbk);

    req.onsuccess = function(e) {
      debug("Push URL = " + req.result);

      // Send url to application server
      var serverURL = self.waurl + '/ApplicationServer/register?push_url=' + req.result;
      self.requestToApplicationServer(serverURL, function(success, error){
        if (error) {
          debug(error);
        } else {
          debug("Application ready to receive notifications");
        }
      });
    };

    req.onerror = function(e) {
      debug("Error registering app: " + e);
    }
  },

  requestToApplicationServer: function(url, callback) {
    var xhr = new XMLHttpRequest({mozSystem:true});
    xhr.open('GET', url, true);

    var self = this;
    xhr.onload = function() {
      if (xhr.status === 200) {
        if (callback)
          callback(xhr.responseText, null);
      } else {
        if (callback) {
          callback(null, "Error code " + xhr.status);
        }
      }
    };

    xhr.onerror = function() { if (callback) { callback(null, 'Error connecting to application server');}};

    xhr.ontimeout = function() {
      if (callback) { callback(null, 'Timeout error')};
    }

    xhr.send();
  },

  // Init store for saving info.
  initStore: function initStore(callback) {
    var req = this.indexedDB.open(DB_NAME, 1.0);

    var self = this;
    req.onsuccess = function(event) {
      self.db = req.result;
      self.restoreData(req.result, callback);
    };

    req.onerror = function(e) {
      debug("Can not open DB.");
      callback(null, "Can not open DB");
    };

    req.onupgradeneeded =  function(event) {
      self.initStoreSchema(req.result);
    };
  },

  initStoreSchema: function initStoreSchema(db) {
    debug("Init db schema");

    db.createObjectStore(STORE_NAME, { keyPath: "id" });
  },

  restoreData: function restoreData(db, callback) {
    debug("Restore data from DB");
    var transaction = db.transaction([STORE_NAME], "readonly");
    var store = transaction.objectStore(STORE_NAME);

    var result = {watoken: null,
                  pbk: null};
    var req = store.get("server_app_data");
    req.onsuccess = function (event) {
      if (this.result) {
        result.watoken = this.result.watoken;
        result.pbk =this.watoken = this.result.pbk;
      }
      callback(result, null);
    };
    req.onerror = function (event) {
      debug("restoreUAData onerror");
      callback(result, null);
    };
  },

  saveData: function saveData(pbk, watoken, callback) {
    var transaction = this.db.transaction([STORE_NAME], "readwrite");
    var store = transaction.objectStore(STORE_NAME);

    //var req = store.put({pbk: pbk, watoken: watoken}, "app_server_data");
    var req = store.put({id: "server_app_data", watoken: watoken, pbk: pbk});
    req.onerror = function (event) {
      if (DEBUG) {
        debug("fails on saveAData: " + event.errorCode);
      }
    }

    req.onsuccess = function (event) {
      callback();
    }
  },

  onclear: function() {
    this.logArea.innerHTML = '';
  },

  /**
    * Logs every message from the websocket
    */
  logMessage: function(message) {
    var msg = message + '</br>';
    this.logArea.innerHTML += msg;
  }
};

window.addEventListener('load', function pushOnLoad(evt) {
  window.removeEventListener('load', pushOnLoad);
  Push.init();
});

window.addEventListener('unload', function pushOnUnLoad(evt) {
  window.removeEventListener('unload', pushOnUnLoad);
  navigator.mozSetMessageHandler("push-notification", null);
});
