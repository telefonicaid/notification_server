'use strict';

var Push = {
  init: function() {
    this.watoken = "testing_user";

    this.registerAppButton = document.getElementById('buttonRegisterApp');
    this.getURLButton = document.getElementById('buttonGetURL');
    this.clearButton = document.getElementById('buttonClear');
    this.logArea = document.getElementById('logarea');

    this.registerAppButton.addEventListener('click', this.registerApp.bind(this));
    this.getURLButton.addEventListener('click', this.getURL.bind(this));
    this.clearButton.addEventListener('click', this.onclear.bind(this));

    if(navigator.mozPush) {
      this.logMessage('[INIT] Please, register application ;)');
    } else {
      this.logMessage('[INIT] No navigator.mozPush object found !');
    }
  },

  onclear: function() {
    this.logArea.innerHTML = '';
  },

  registerApp: function() {
    var self = this;
    this.logMessage("[registerApp] Registering application with token id = " + this.watoken);

    if(!navigator.mozPush) {
      this.logMessage("[registerApp] No navigator.mozPush object found !");
    } else {
      this.logMessage("[registerApp] Calling navigator.mozPush.requestURL('" + this.watoken + "') ...");
      var req = navigator.mozPush.requestURL(this.watoken);
      req.onsuccess = function(e) {
        self.logMessage("[registerApp] URL = " + req.result.url);

        // Registering to receive PUSH notifications
        try {
          self.logMessage("[registerApp:PUSH] Registering for messaging");
          navigator.mozSetMessageHandler("push-notification", function(msg) {
            self.logMessage("[registerApp:PUSH] New Message");
            self.logMessage(JSON.stringify(msg));
          });
        } catch(e) {
          self.logMessage("[registerApp] This platform does not support system messages.");
        }

      };
      req.onerror = function(e) {
        self.logMessage("[registerApp] Error registering app");
      }
    }
  },

  getURL: function() {
    var self = this;
    this.logMessage("[getURL] Getting current Notification URL");
    
    if(!navigator.mozPush) {
      this.logMessage("[getURL] No navigator.mozPush object found !");
    } else {
      try {
        var req = navigator.mozPush.getCurrentURL();
        req.onsuccess = function(e) {
          self.logMessage("[getURL] URL = " + req.result.url);
        };
        req.onerror = function(e) {
          self.logMessage("[getURL] Error getting URL");
        }
      } catch(e) {
        this.logMessage("JARRRRL");
      }
    }
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
