'use strict';

// To create Base64 strings for pbk
function utf8_to_b64( str ) {
  return window.btoa(unescape(encodeURIComponent( str )));
}

var Push = {
  pbk: '-----BEGIN PUBLIC KEY-----\n' +
       'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDFW14SniwCfJS//oKxSHin/uC1\n' +
       'P6IBHiIvYr2MmhBRcRy0juNJH8OVgviFKEV3ihHiTLUSj94mgflj9RxzQ/0XR8tz\n' +
       'PywKHxSGw4Amf7jKF1ZshCUdyrOi8cLfzdwIz1nPvDF4wwbi2fqseX5Y7YlYxfpF\n' +
       'lx8GvbnYJHO/50QGkQIDAQAB\n' +
       '-----END PUBLIC KEY-----',

  publicURL: null,

  init: function() {
    this.pushURL = document.getElementById('pushURL');
    this.logArea = document.getElementById('logArea');
    this.notificationArea = document.getElementById('notificationArea');

    this.clearButton = document.getElementById('buttonClear');
    this.clearButton.addEventListener('click', this.onclear.bind(this));

    this.logMessage('[INIT] App started');

    try {
      // Register for messaging
      var self = this
      navigator.mozSetMessageHandler('notification', function(msg) {
        // Bring app to foreground
        navigator.mozApps.getSelf().onsuccess = function getSelfCB(evt) {
          var app = evt.target.result;
          app.launch('TwitterPush');
        };

        // Process message
        self.logMessage("New Message: " + JSON.stringify(msg));
        self.notificationMessage(msg.message);
      });
    } catch(e) {
      self.logMessage("This platform does not support system messages.");
    }

    this.registerWA();
  },

  /**
   * Push API
   */
  registerWA: function() {
    this.logMessage("Requesting URL");
    var req = navigator.mozPush.requestURL(
      "publicTwitterStream",
      utf8_to_b64(this.pbk));

    var self = this;
    req.onsuccess = function(e) {
      self.showURL(req.result);
      self.logMessage(req.result);
      self.publicURL = req.result;
    };
  },

  /**
   * Text areas
   */
  showURL: function(message) {
    this.pushURL.innerHTML = message;
  },

  logMessage: function(message) {
    var msg = message + '</br>';
    this.logArea.innerHTML += msg;
  },

  onclear: function() {
    this.logArea.innerHTML = '';
  },

  notificationMessage: function(message) {
    var msg = message + '</br>';
    this.notificationArea.innerHTML += msg;
  }
};

window.addEventListener('load', function pushOnLoad(evt) {
  window.removeEventListener('load', pushOnLoad);
  Push.init();
});
