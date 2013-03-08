'use strict';

var DEBUG = true;
var DB_NAME = 'push_app_db';
var STORE_NAME = 'push_app_store';

function debug(msg) {
  if (!DEBUG)
    return;
  dump('[DEBUG] PushApp: ' + msg + '\n');
}

var Push = {

  init: function() {
    debug("Init");
    this.waurl = "http://192.168.1.48:8888";
    this.endpoint = null;

    this.indexedDB = window.mozIndexedDB || window.webkitIndexedDB || window.indexedDB;
    this.database;

    this.logArea = document.getElementById('logarea');

    try {
      // Register for messaging
      var self = this
      navigator.mozSetMessageHandler('push', function(msg) {
        debug("New Message: " + JSON.stringify(msg));

        // Bring app to foreground
        navigator.mozApps.getSelf().onsuccess = function getSelfCB(evt) {
          var app = evt.target.result;
          app.launch('push');
        };

        var version = msg.version;
        var serverURL = self.waurl + '/ApplicationServer/register?version=' + version;
        self.requestToApplicationServer(serverURL, function(success, error){
          if (error) {
            debug(error);
          } else {
            self.logMessage(success);
          }
        });

      });
    } catch(e) {
      debug("This platform does not support system messages.");
    }

    this.initStore(function (success, error){
      if (success && success.endpoint) {
        this.endpoint = success.endpoint;
        debug("endpoint from db: " + this.endpoint);
        this.sendEndpointToWAServer(this.endpoint);
        return;
      }

      this.requestURL();
      //this.clearDB();
    }.bind(this));
  },

  requestURL: function() {
    var self = this;
    var req = navigator.pushNotification.register();

    req.onsuccess = function(e) {
      self.endpoint = req.result.pushEndpoint;
      debug("New endpoint: " + self.endpoint);
      self.saveData(req.result.pushEndpoint);
      self.sendEndpointToWAServer(self.endpoint);
    };

    req.onerror = function(e) {
      debug("Error registering app: " + JSON.stringify(e));
    }
  },

  sendEndpointToWAServer: function(endpoint) {
    // Send url to application server
    var serverURL = this.waurl + '/ApplicationServer/register?push_url=' + endpoint;
    this.requestToApplicationServer(serverURL, function(success, error){
      if (error) {
        debug(error);
      } else {
        debug("Application ready to receive notifications");
      }
    });
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

    var result = {endpoint: null};
    var req = store.get("server_app_data");
    req.onsuccess = function (event) {
      if (this.result) {
        result.endpoint = this.result.endpoint;
      }
      callback(result, null);
    };
    req.onerror = function (event) {
      debug("restoreUAData onerror");
      callback(result, null);
    };
  },

  saveData: function saveData(endpoint) {
    var transaction = this.db.transaction([STORE_NAME], "readwrite");
    var store = transaction.objectStore(STORE_NAME);

    var req = store.put({id: "server_app_data", endpoint: endpoint});
    req.onerror = function (event) {
      if (DEBUG) {
        debug("fails on saveAData: " + event.errorCode);
      }
    }
  },

  clearDB: function clearDB() {
    var transaction = this.db.transaction([STORE_NAME], "readwrite");
    var store = transaction.objectStore(STORE_NAME);
    store.clear();
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
