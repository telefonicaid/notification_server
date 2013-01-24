'use strict';

//To create base64 strings for pbk
function utf8_to_b64( str ) {
  return window.btoa(unescape(encodeURIComponent( str )));
}
function b64_to_utf8( str ) {
  return decodeURIComponent(escape(window.atob( str )));
}

var Push = {

  MAX_RETRIES: 1,
  actualRetries: 0,

  ad: 'localhost:8080',
  ad_ws: null,
  ad_http: null,

  ws: {
    connection: null,
    ready: false
  },

  token: null,

  urlApp1: null,
  urlApp2: null,

  init: function() {
    this.ad_ws = 'wss://' + this.ad;
    this.ad_http = 'https://' + this.ad;

    this.getTokenButton = document.getElementById('buttonGetToken');
    this.registerDeviceButton = document.getElementById('buttonRegisterDevice');
    this.unregisterDeviceButton = document.getElementById('buttonUnregisterDevice');
    this.clearButton = document.getElementById('buttonClear');
    this.registerAppButton1 = document.getElementById('buttonRegisterApp1');
    this.registerAppButton2 = document.getElementById('buttonRegisterApp2');
    this.unregisterAppButton1 = document.getElementById('buttonUnregisterApp1');
    this.getRegisteredWAButton = document.getElementById('buttonGetRegisteredWA');
    this.logArea = document.getElementById('logarea');
    this.checkbox = document.getElementById('checkBox');
    this.ip = document.getElementById('ip');
    this.port = document.getElementById('port');
    this.mcc = document.getElementById('mcc');
    this.mnc = document.getElementById('mnc');
    this.proto = document.getElementById('proto');
    this.tokenPlace = document.getElementById('token');

    this.getTokenButton.addEventListener('click', this.getToken.bind(this));
    this.registerDeviceButton.addEventListener('click', this.registerDevice.bind(this));
    this.unregisterDeviceButton.addEventListener('click', this.unregisterDevice.bind(this));
    this.registerAppButton1.addEventListener('click', this.registerApp1.bind(this));
    this.registerAppButton2.addEventListener('click', this.registerApp2.bind(this));
    this.unregisterAppButton1.addEventListener('click', this.unregisterApp1.bind(this));
    this.clearButton.addEventListener('click', this.onclear.bind(this));
    this.getRegisteredWAButton.addEventListener('click', this.onGetRegisteredWA.bind(this));

    this.logMessage('[INIT] Notification server: ' + this.ad);
  },

  onclear: function() {
    this.logArea.innerHTML = '';
  },

  getToken: function() {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = (function() {
      if (xmlhttp.readyState == 4) {
        if (xmlhttp.status == 200) {
          this.token = xmlhttp.responseText;
          this.tokenPlace.value = this.token;
        } else {
          this.logMessage('[TOK] The notification server is not working');
        }
      }
    }.bind(this));
    xmlhttp.open('GET', this.ad_http + '/token', true);
    xmlhttp.send(null);
  },

  registerDevice: function() {
    this.onReceivedToken();
  },

  unregisterDevice: function() {
    var msg = '{"messageType":"unregisterUA" }';
    this.logMessage('Preparing to send: ' + msg);
    this.ws.connection.send(msg);
  },

  registerApp: function(uatoken, watoken, pbkbase64) {
    var msg = '{"data": {"uatoken": "' + uatoken + '", "watoken": "' + watoken + '", "pbkbase64": "' + pbkbase64 + '"}, "messageType":"registerWA" }';
    this.logMessage('Preparing to send: ' + msg);

    if (this.ws.connection.readyState !== 1) {
      this.logMessage("[DEBUG] WS close ... I'll open it ...");
      this.ws.connection = new WebSocket(this.ad_ws, 'push-notification');
      this.logMessage('[WS] Opening websocket to ' + this.ad_ws);
      this.ws.connection.onopen = (function() {
        this.ws.connection.send(msg);
        this.logMessage('[REG] Application 1 registered');
        this.ws.connection.close();
      }).bind(this);
      return;
    }
    this.ws.connection.send(msg);
    this.logMessage('[REG] Application 1 registered');
  },

  unregisterApp: function(uatoken, watoken, pbkbase64) {
    var msg = '{"data": {"watoken": "' + watoken + '", "pbkbase64": "' + pbkbase64 + '"}, "messageType":"unregisterWA" }';
    this.logMessage('Preparing to send: ' + msg);

    if (this.ws.connection.readyState !== 1) {
      this.logMessage("[DEBUG] WS close ... I'll open it ...");
      this.ws.connection = new WebSocket(this.ad_ws, 'push-notification');
      this.logMessage('[WS] Opening websocket to ' + this.ad_ws);
      this.ws.connection.onopen = (function() {
        this.ws.connection.send(msg);
        this.logMessage('[REG] Application 1 unregistered');
        this.ws.connection.close();
      }).bind(this);
      return;
    }
    this.ws.connection.send(msg);
    this.logMessage('[REG] Application 1 unregistered');
  },

  registerApp1: function() {
    var pbk1 = '-----BEGIN PUBLIC KEY-----\n' +
               'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDFW14SniwCfJS//oKxSHin/uC1\n' +
               'P6IBHiIvYr2MmhBRcRy0juNJH8OVgviFKEV3ihHiTLUSj94mgflj9RxzQ/0XR8tz\n' +
               'PywKHxSGw4Amf7jKF1ZshCUdyrOi8cLfzdwIz1nPvDF4wwbi2fqseX5Y7YlYxfpF\n' +
               'lx8GvbnYJHO/50QGkQIDAQAB\n' +
               '-----END PUBLIC KEY-----';
    this.registerApp(this.token, 'app1', utf8_to_b64(pbk1));
  },

  unregisterApp1: function() {
    var pbk1 = '-----BEGIN PUBLIC KEY-----\n' +
               'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDFW14SniwCfJS//oKxSHin/uC1\n' +
               'P6IBHiIvYr2MmhBRcRy0juNJH8OVgviFKEV3ihHiTLUSj94mgflj9RxzQ/0XR8tz\n' +
               'PywKHxSGw4Amf7jKF1ZshCUdyrOi8cLfzdwIz1nPvDF4wwbi2fqseX5Y7YlYxfpF\n' +
               'lx8GvbnYJHO/50QGkQIDAQAB\n' +
               '-----END PUBLIC KEY-----';
    this.unregisterApp(this.token, 'app1', utf8_to_b64(pbk1));
  },

  registerApp2: function() {
    this.registerApp(this.token, 'app2', '');
  },

  onGetRegisteredWA: function() {
    var msg = '{"messageType":"getRegisteredWA"}';
    this.logMessage('Preparing to send: ' + msg);
    this.ws.connection.send(msg);
  },

  onReceivedToken: function() {
    if (this.token === null) {
      return;
    }
    this.logMessage('[TOK] Token from the notification server (or saved)' + this.token);
    this.ws.connection = new WebSocket(this.ad_ws, 'push-notification');
    this.logMessage('[WS] Opening websocket to ' + this.ad_ws);
    this.ws.connection.onopen = this.onOpenWebsocket.bind(this);
    this.ws.connection.onclose = this.onCloseWebsocket.bind(this);
    this.ws.connection.onerror = this.onCloseWebsocket.bind(this);
  },

  onDeleteToken: function() {
    this.logMessage('[TOK][REG] We are disconnecting our tokens');
    /*this.token = null;
    this.urlApp1 = null;
    this.urlApp2 = null;*/
    this.ws.connection.close();
    this.logMessage('[TOK][REG] Tokens deleted');
  },

  onOpenWebsocket: function() {
    this.logMessage('[WS] Opened connection to ' + this.ad);
    this.ws.ready = true;
    this.logMessage('[REG] Started registration to the notification server');
    if (this.checkbox.checked) {
      if (this.proto.checked) {
        this.ws.connection.send('{"data": {"uatoken":"' + this.token + '", "interface": { "ip": "' + this.ip.value + '", "port": "' + this.port.value + '" }, "mobilenetwork": { "mcc": "' + this.mcc.value + '", "mnc": "' + this.mnc.value + '" }, "protocol": "tcp" }, "messageType":"registerUA"}');
      } else {
        this.ws.connection.send('{"data": {"uatoken":"' + this.token + '", "interface": { "ip": "' + this.ip.value + '", "port": "' + this.port.value + '" }, "mobilenetwork": { "mcc": "' + this.mcc.value + '", "mnc": "' + this.mnc.value + '" } }, "messageType":"registerUA"}');
      }
    } else {
      this.ws.connection.send('{"data": {"uatoken":"' + this.token + '"}, "messageType":"registerUA"}');
    }
    this.ws.connection.onmessage = (function(e) {
      this.logMessage('[MSG] message received --- ' + e.data);
      var msg = JSON.parse(e.data);
      if(msg[0].messageType == 'notification') {
        var ack = '{"messageType": "ack", "messageId": "' + msg[0].messageId + '"}';
        this.logMessage('[MSG ACK] Going to ack the message ' +msg[0].messageId);
        this.ws.connection.send(ack);
      }
    }).bind(this);
  },

  onErrorWebsocket: function(e) {
    this.logMessage('[WS] Error in websocket in ' + this.ad + ' with error ' + e.error);
  },

  onCloseWebsocket: function(e) {
    this.logMessage('[WS] Closed connection to ' + this.ad + ' with code ' + e.code + ' and reason ' + e.reason);
    this.ws.ready = false;
    //HACK to reconnect
    if (this.MAX_RETRIES > ++this.actualRetries) {
      this.onReceivedToken();
    } else {
      this.logMessage('[WS] MAX_RETRIES reached. Stopping');
    }
  },

  /**
   * Logs every message from the websocket
   */
  logMessage: function(message) {
    var msg = (new Date()).getTime() + " -- " + message + '</br>';
    this.logArea.innerHTML += msg;
  }
};

window.addEventListener('load', function pushOnLoad(evt) {
  window.removeEventListener('load', pushOnLoad);
  Push.init();
});
