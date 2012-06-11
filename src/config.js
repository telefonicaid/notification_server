/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

/**
 * Binding interfaces and ports
 * [ iface, port ]
 */
exports.ifaces = [
  // Internal network
  {
    iface: "0.0.0.0",
    port: 8080 },
  // External network
  {
    iface: "127.0.0.1",
    port: 8081,
  }
];

/**
 * Public base URL to receive notifications
 */
exports.publicBaseURL = "http://localhost:8081";

/**
 * Websocket configuration
 * @see https://github.com/Worlize/WebSocket-Node/blob/master/lib/WebSocketServer.js
 */
exports.websocket_params = {
  keepalive: true,
  keepaliveInterval: 40000,
  dropConnectionOnKeepaliveTimeout: true,
  keepaliveGracePeriod: 30000
};

/**
 * Server id params (for TOKEN generation & validation)
 */
exports.server_info = {
  id: "0000000001",
  key: "12345678901234567890"
}