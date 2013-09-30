'use strict';

var DEBUG = true;

function debug(msg) {
  if (!DEBUG)
    return;
  dump('[DEBUG] PushApp_A: ' + msg + '\n');
}

var Push = {

  init: function() {
    debug("Init");

    this.endpoint = null;
    this.registered = false;

    this.status = document.getElementById('status');
    this.button = document.getElementById('button1');
    this.logArea = document.getElementById('logarea');
    this.countryLabel = document.getElementById('country');
    this.settings_view = document.getElementById('settings_view');
    this.main_view = document.getElementById('main_view');
    this.settings_selector = document.getElementById('url');
    this.settings_button = document.getElementById('button_settings');
    this.clear_button = document.getElementById('button_clear');

    this.button.onclick = this.processButtonClick.bind(this);
    this.settings_button.onclick = this.processSettingsClick.bind(this);
    this.clear_button.onclick = this.processClearClick.bind(this);

    this.loadSettingsView();
  },

  loadSettingsView: function() {
    var self = this;
    asyncStorage.getItem("url", function(value) {
      if (value === null) {
        debug("no settings");

        self.readSettingsFile(function onsuccess(data) {
          self.settings_selector.options.length = 0;
          for (var i = 0; i < data.length; i++) {
            var d = data[i];
            self.settings_selector.options.add(new Option(d.id, d.url));
          }

          self.settings_view.style.display = 'block';
        }, function onerror(error) {
          debug("Error reading settings");
        });

        return;
      }

      self.waurl = value;
      asyncStorage.getItem("country", function(value) {
        self.country = value;
        self.loadMainView();
      });
    });
  },

  processSettingsClick: function() {
    this.country = this.settings_selector.options[this.settings_selector.selectedIndex].text;
    this.waurl = this.settings_selector.options[this.settings_selector.selectedIndex].value;

    asyncStorage.setItem('country', this.country);
    asyncStorage.setItem('url', this.waurl);

    this.loadMainView();
  },

  loadMainView: function() {
    this.settings_view.style.display = 'none';
    this.main_view.style.display = 'block';

    this.countryLabel.innerHTML = this.country;
    this.status.innerHTML = "Registering";

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
        var serverURL = self.waurl + '/ApplicationServer_a/register?version=' + version;
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

    this.requestURL();
  },

  processClearClick: function() {
    this.button.style.visibility = "hidden";
    if (this.registered){
      this.status.innerHTML = "Unregistering";
      this.unregister();
    }

    asyncStorage.removeItem('url');
    asyncStorage.removeItem('country');
    this.loadSettingsView();
  },

  readSettingsFile: function readSettingsFile(onsuccess, onerror) {
    var URI = '/settings/servers.json';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', URI, true); // async
    xhr.overrideMimeType('application/json');
    xhr.responseType = 'json';
    xhr.onload = function() {
      if (xhr.status === 200) {
        if (onsuccess) onsuccess(xhr.response);
      } else {
        console.error('Failed to fetch servers configuration file. ' + xhr.statusText);
        if (onerror) onerror();
      }
    };
    xhr.send();
  },

  requestURL: function() {
    var self = this;
    var req = navigator.push.register();

    req.onsuccess = function(e) {
      self.endpoint = req.result;
      debug("Endpoint: " + self.endpoint);
      self.sendEndpointToWAServer(self.endpoint);
    };

    req.onerror = function(e) {
      self.enableRegister();
      self.log("push.register() error: " + e.target.error.name, true);
    }
  },

  unregister: function() {
    var self = this;
    var req = navigator.push.unregister(this.endpoint);

    req.onsuccess = function(e) {
      var serverURL = self.waurl + '/ApplicationServer_a/unregister?push_url=' + self.endpoint;
      self.requestToApplicationServer(serverURL, function(success, error){
        if (error) {
          self.log("server " + serverURL + " returned " + error, true);
          self.enableUnregister();
        } else {
          self.endpoint = null;
          self.enableRegister();
        }
      });
    };

    req.onerror = function(e) {
      self.enableUnregister();
      self.log("push.unregister() error: " + e.target.error.name, true);
    };
  },

  log: function(text, error) {
    debug(text);
    this.logMessage(text, error);
  },

  sendEndpointToWAServer: function(endpoint) {
    // Send url to application server
    var serverURL = this.waurl + '/ApplicationServer_a/register?push_url=' + endpoint;
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
      this.requestURL(); 
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
