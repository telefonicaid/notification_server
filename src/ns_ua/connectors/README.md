/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

The connectors folder includes classes to manage the different ways to connect with a node

* connector_ws: The connection is done through an open WebSocket
* connector_udp: The connection is done by closing the websocket and pinging the IP and port given by the client

connector_base defines the connector interface and implements a dummy one
