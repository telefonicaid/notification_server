"use strict";

var Push = {

    MAX_RETRIES: 1,
    actualRetries: 0,

    ad: "localhost:8080",
    ad_ws: null,
    ad_http: null,

    ws: {
        connection: null,
        ready: false,
    },

    token: null,

    /**
     * This initializes the app
     */
    init: function() {
        this.ad_ws = "ws://" + this.ad;
        this.ad_http = "http://" + this.ad;
        // TODO: get from mozSettings the "token"
        /*savedToken = getToken();
        if (savedToken !== null) {
            this.token = savedToken;
        }
        */
        // Assign UI elements to variables
        this.registerDeviceButton = document.getElementById("buttonRegisterDevice");
        this.unregisterDeviceButton = document.getElementById("buttonUnregisterDevice");
        this.registerAppButton = document.getElementById("buttonRegisterApp");
        this.logArea = document.getElementById("logarea");
        this.clearButton = document.getElementById("buttonClear");
        this.registerDeviceButton.disabled = false;
        this.registerDeviceButton.addEventListener('click', this.registerDevice.bind(this));
        this.unregisterDeviceButton.addEventListener('click', this.unregisterDevice.bind(this));
        this.clearButton.addEventListener('click', this.onclear.bind(this));
    },

    onclear: function() {
        this.logArea.innerHTML = "";
    },

    /**
     * Function called to register the device to the notification server
     */
    registerDevice: function() {
        if (this.token === null) {
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = function() {
                if(xmlhttp.readyState == 4){
                    if(xmlhttp.status == 200) {
                        Push.token = xmlhttp.responseText;
                        Push.onReceivedToken();
                    } else {
                        Push.logMessage("[TOK] The notification server is not working")
                    }
                }
            };
            xmlhttp.open("GET", this.ad_http + "/token",true);
            xmlhttp.send(null);
        }
    },

    unregisterDevice: function() {
        this.onDeleteToken();
    },

    onReceivedToken: function() {
        if(this.token === null) {
            return;
        }
        this.logMessage("[TOK] Token from the notification server (or saved)" + this.token);
        this.ws.connection = new WebSocket(this.ad_ws, "push-notification");
        this.logMessage("[WS] Opening websocket to " + this.ad_ws);
        this.ws.connection.onopen = this.onOpenWebsocket.bind(this);
        this.ws.connection.onclose = this.onCloseWebsocket.bind(this);
        this.ws.connection.onerror = this.onCloseWebsocket.bind(this);
        this.registerDeviceButton.disabled=true;
        this.unregisterDeviceButton.disabled=false;
    },

    onDeleteToken: function() {
        this.logMessage("[TOK] We are deleting our token!");
        this.token = null;
        this.ws.connection.close();
        this.logMessage("[TOK] Token deleted")
        this.registerDeviceButton.disabled=false;
        this.unregisterDeviceButton.disabled=true;
    },

    onOpenWebsocket: function() {
        this.logMessage("[WS] Opened connection to " + this.ad);
        this.ws.ready = true;
        this.logMessage("[REG] Started registration to the notification server");
        this.ws.connection.send('{"data": {"token":"' + this.token + '", "iface": { "ip": "127.0.0.1", "port": "5000" } }, "command":"register/node"}');
        this.ws.connection.onmessage = function(e) {
            Push.logMessage("[MSG] message received --- " + e.data);
        };
    },

    onErrorWebsocket: function(e) {
        this.logMessage("[WS] Error in websocket in " + this.ad + " with error " + e.error);
    },

    onCloseWebsocket: function(e) {
        this.logMessage("[WS] Closed connection to " + this.ad + " with code " + e.code + " and reason " + e.reason);
        this.ws.ready = false;
        //HACK to reconnect
        if (this.MAX_RETRIES>++this.actualRetries) {
            this.onReceivedToken();
        } else {
            this.logMessage("[WS] MAX_RETRIES reached. Stopping")
        }
    },

    /**
     * Logs every message from the websocket
     */
     logMessage: function(message) {
        var msg = message + "</br>";
        this.logArea.innerHTML += msg;
     },
};

window.addEventListener('load', function pushOnLoad(evt) {
  window.removeEventListener('load', pushOnLoad);
  Push.init();
});
