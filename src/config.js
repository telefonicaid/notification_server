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
    iface: "127.0.0.1",
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
exports.publicBaseURL: "http://localhost";

