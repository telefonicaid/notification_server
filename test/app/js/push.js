"use strict";

var Push = {

    MAX_RETRIES: 1,
    actualRetries: 0,

    //ad: "push.handsets.es:8080",
    ad: "localhost:8080",
    ad_ws: null,
    ad_http: null,

    ws: {
        connection: null,
        ready: false,
    },

    token: null,

    urlApp1: null,
    urlApp2: null,

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
        this.clearButton = document.getElementById("buttonClear");
        this.registerAppButton1 = document.getElementById("buttonRegisterApp1");
        this.registerAppButton2 = document.getElementById("buttonRegisterApp2");
        this.logArea = document.getElementById("logarea");
        this.checkbox = document.getElementById("checkBox");
        this.ip = document.getElementById("ip");
        this.port = document.getElementById("port");

        this.registerDeviceButton.disabled = false;
        // Listeners
        this.registerDeviceButton.addEventListener('click', this.registerDevice.bind(this));
        this.unregisterDeviceButton.addEventListener('click', this.unregisterDevice.bind(this));
        this.registerAppButton1.addEventListener('click', this.registerApp1.bind(this));
        this.registerAppButton2.addEventListener('click', this.registerApp2.bind(this));
        this.clearButton.addEventListener('click', this.onclear.bind(this));

        Push.logMessage("[INIT] Notification server: " + this.ad);
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
            xmlhttp.open("GET", this.ad_http + "/token", true);
            xmlhttp.send(null);
        }
    },

    unregisterDevice: function() {
        this.onDeleteToken();
    },

    registerApp1: function() {
        this.ws.connection.send('{"data": {"uatoken":"' + Push.token + '", "watoken": "app1" }, "command":"register/wa"}');
        Push.logMessage("[REG] Application 1 registered");
    },

    registerApp2: function() {
        this.ws.connection.send('{"data": {"uatoken":"' + Push.token + '", "watoken": "app2" }, "command":"register/wa"}');
        Push.logMessage("[REG] Application 2 registered");
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
        this.logMessage("[TOK][REG] We are deleting our tokens");
        this.token = null;
        this.urlApp1 = null;
        this.urlApp2 = null;
        this.ws.connection.close();
        this.logMessage("[TOK][REG] Tokens deleted")
        this.registerDeviceButton.disabled=false;
        this.unregisterDeviceButton.disabled=true;
    },

    onOpenWebsocket: function() {
        this.logMessage("[WS] Opened connection to " + this.ad);
        this.ws.ready = true;
        this.logMessage("[REG] Started registration to the notification server");
        if (this.checkbox.checked) {
            this.ws.connection.send('{"data": {"uatoken":"' + this.token + '", "interface": { "ip": "' + this.ip.value + '", "port": "' + this.port.value + '" } }, "command":"register/ua"}');
        } else {
            this.ws.connection.send('{"data": {"uatoken":"' + this.token + '"}, "command":"register/ua"}');
        }
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
