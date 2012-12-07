'use strict';

// To create Base64 strings for pbk
function utf8_to_b64( str ) {
  return window.btoa(unescape(encodeURIComponent( str )));
}

var Push = {
  ip: "10.0.0.1",
  port: "8888",
  mcc: "214",
  mnc: "",//"07", // Commented to avoid UDP wakeup on desktop !
  pbk: '-----BEGIN PUBLIC KEY-----\n' +
       'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDFW14SniwCfJS//oKxSHin/uC1\n' +
       'P6IBHiIvYr2MmhBRcRy0juNJH8OVgviFKEV3ihHiTLUSj94mgflj9RxzQ/0XR8tz\n' +
       'PywKHxSGw4Amf7jKF1ZshCUdyrOi8cLfzdwIz1nPvDF4wwbi2fqseX5Y7YlYxfpF\n' +
       'lx8GvbnYJHO/50QGkQIDAQAB\n' +
       '-----END PUBLIC KEY-----',

  ad: 'localhost:8080',
  ad_ws: null,
  ad_http: null,

  ws: {
    connection: null,
    ready: false
  },

  token: null,
  publicURL: null,

  init: function() {
    this.ad_ws = 'wss://' + this.ad;
    this.ad_http = 'https://' + this.ad;
    this.pushURL = document.getElementById('pushURL');
    this.logArea = document.getElementById('logArea');
    this.notificationArea = document.getElementById('notificationArea');

    this.startButton = document.getElementById('buttonStart');
    this.startButton.addEventListener('click', this.buttonStart.bind(this));

    this.clearButton = document.getElementById('buttonClear');
    this.clearButton.addEventListener('click', this.onclear.bind(this));

    this.logMessage('[INIT] Notification server: ' + this.ad);
  },

  close: function() {
    this.sendWS({
      data: {
       uatoken: this.uatoken
      },
      messageType: "unregisterUA"
    });
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
  },

  /**
   * Push API
   */
  buttonStart: function() {
    // First get a valid UAToken, then register UA, then register WA
    this.getToken(function openWebSocket(uatoken) {
      this.uatoken = uatoken;

      this.logMessage('[TOK] Token from the notification server' + this.uatoken);
      this.ws.connection = new WebSocket(this.ad_ws, 'push-notification');
      this.logMessage('[WS] Opening websocket to ' + this.ad_ws);

      this.ws.connection.onopen = this.onOpenWebsocket.bind(this);
      this.ws.connection.onclose = this.onCloseWebsocket.bind(this);
      this.ws.connection.onerror = this.onErrorWebsocket.bind(this);
      this.ws.connection.onmessage = this.onMessageWebsocket.bind(this);
    }.bind(this));
  },

  getToken: function(cb) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = (function() {
      if (xmlhttp.readyState == 4) {
        if (xmlhttp.status == 200) {
          cb(xmlhttp.responseText);
        } else {
          this.logMessage('[TOK] The notification server is not working');
        }
      }
    }.bind(this));
    xmlhttp.open('GET', this.ad_http + '/token', true);
    xmlhttp.send(null);    
  },

  sendWS: function(json) {
    var msg = JSON.stringify(json);
    this.logMessage('[WS] Preparing to send: ' + msg);
    this.ws.connection.send(msg);
  },

  onOpenWebsocket: function() {
    this.logMessage('[WS] Opened connection to ' + this.ad);
    this.ws.ready = true;
    this.logMessage('[REG] Started registration to the notification server');
    this.sendWS({
      data: {
        uatoken: this.uatoken,
        'interface': {
          ip: this.ip,
          port: this.port
        },
        mobilenetwork: {
          mcc: this.mcc,
          mnc: this.mnc
        },
        protocol: "tcp"
      },
      messageType: "registerUA"
    });
  },

  onCloseWebsocket: function(e) {
    this.logMessage('[WS] Closed connection to ' + this.ad + ' with code ' + e.code + ' and reason ' + e.reason);
    this.ws.ready = false;
  },

  onErrorWebsocket: function(e) {
    this.logMessage('[WS] Error in websocket in ' + this.ad + ' with error ' + e.error);
    this.ws.ready = false;
  },

  onMessageWebsocket: function(e) {
    this.logMessage('[MSG] message received --- ' + e.data);
    var msg = JSON.parse(e.data);
    if(msg[0]) {
      for(var m in msg) {
        this.manageResponse(msg[m]);
      }
    } else {
      this.manageResponse(msg);
    }
  },

  manageResponse: function(msg) {
    switch(msg.messageType) {
      case 'registerUA':
        this.logMessage('[MSG registerUA] Going to register WA');
        this.sendWS({
          data: {
            watoken: "publicTwitterStream",
            pbkbase64: utf8_to_b64(this.pbk)
          },
          messageType: "registerWA"
        });
        break;

      case 'registerWA':
        this.logMessage('[MSG registerWA] Registered WA');
        this.showURL(msg.url);
        break;

      case 'notification':
        this.logMessage('[MSG notification] Going to ack the message ' + msg.messageId);
        this.notificationMessage(msg.message);
        this.sendWS({
          messageType: "ack",
          messageId: msg.messageId
        });
        break;
    }
  }
};

window.addEventListener('load', function pushOnLoad(evt) {
  window.removeEventListener('load', pushOnLoad);
  Push.init();
});

window.addEventListener('beforeunload', function(evt) {
  Push.close();
});
