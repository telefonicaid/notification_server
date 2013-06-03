'use strict';

var DEBUG = true;
var DB_NAME = 'push_app_db';
var STORE_NAME = 'push_app_store';

function debug(msg) {
  if (!DEBUG)
    return;
  dump('[DEBUG] PushApp_B: ' + msg + '\n');
}

var Push = {

  init: function() {
    debug("Init");
    this.waurl = "http://192.168.1.43:9999";
    this.endpoint = null;
    this.registered = false;

    this.indexedDB = window.mozIndexedDB || window.webkitIndexedDB || window.indexedDB;
    this.database;

    this.status = document.getElementById('status');
    this.button = document.getElementById('button1');
    this.logArea = document.getElementById('logarea');
    this.button.onclick = this.processButtonClick.bind(this);

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
        var serverURL = self.waurl + '/ApplicationServer_b/register?version=' + version;
        self.requestToApplicationServer(serverURL, function(success, error){
          if (error) {
            self.log("server " + serverURL + " returned " + error, true);
            self.enableRegister();
          } else {
            self.logMessage(success);
          }
        });

      });
    } catch(e) {
      debug("This platform does not support system messages.");
    }

    this.initStore(function (success, error){
//      this.clearDB();
      if (success && success.endpoint) {
        this.endpoint = success.endpoint;
        debug("endpoint from db: " + this.endpoint);
        this.sendEndpointToWAServer(this.endpoint);
        return;
      }

      this.requestURL();
    }.bind(this));
  },

  register: function() {
    var self = this;
    this.restoreData(this.db, function(success, error){
      if (success && success.endpoint) {
        self.endpoint = success.endpoint;
        debug("endpoint from db: " + self.endpoint);
        self.sendEndpointToWAServer(self.endpoint);
        return;
      }

      self.requestURL();
    });
  },

  unregister: function() {
    var self = this;
    var req = navigator.push.unregister(this.endpoint);

    req.onsuccess = function(e) {
      var serverURL = self.waurl + '/ApplicationServer_b/unregister?push_url=' + self.endpoint;
      self.requestToApplicationServer(serverURL, function(success, error){
        if (error) {
          self.log("server " + serverURL + " returned " + error, true);
          self.enableUnregister();
        } else {
          self.clearDB();
          self.enableRegister();
        }
      });
    };

    req.onerror = function(e) {
      self.enableUnregister();
      self.log("push.unregister() error: " + e.target.error.name, true);
    };
  },

  requestURL: function() {
    var self = this;
    var req = navigator.push.register();

    req.onsuccess = function(e) {
      self.endpoint = req.result;
      debug("New endpoint: " + self.endpoint);
      self.saveData(self.endpoint);
      self.sendEndpointToWAServer(self.endpoint);
      self.enableRegister();
    };

    req.onerror = function(e) {
      self.enableRegister();
      self.log("push.register() error: " + e.target.error.name, true);
    }
  },

  log: function(text, error) {
    debug(text);
    this.logMessage(text, error);
  },

  sendEndpointToWAServer: function(endpoint) {
    // Send url to application server
    var serverURL = this.waurl + '/ApplicationServer_b/register?push_url=' + endpoint;
    var self = this;
    this.requestToApplicationServer(serverURL, function(success, error){
      if (error) {
        self.log("server " + serverURL + " returned " + error, true);
        self.enableRegister();
      } else {
        self.enableUnregister();
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
          callback(null, "error code " + xhr.status);
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

  enableRegister: function() {
    this.registered = false;
    this.status.innerHTML = "Unregistered";
    this.button.innerHTML = "Register"
    this.button.style.visibility = "visible";
  },

  enableUnregister: function() {
    this.registered = true;
    this.status.innerHTML = "Registered";
    this.button.innerHTML = "Unregister"
    this.button.style.visibility = "visible";
  },

  processButtonClick: function() {
    this.button.style.visibility = "hidden";
    if (!this.registered){
      this.status.innerHTML = "Registering";
      this.register(); 
    } else {
      this.status.innerHTML = "Unregistering";
      this.unregister();
    }
  },

  /**
    * Logs every message from the websocket
    */
  logMessage: function(message, error) {
    var msg = document.createElement('li');
    msg.innerHTML = message;
    if (error) {
      msg.className = "error";
    }
    this.logArea.insertBefore(msg, this.logArea.firstChild);
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
