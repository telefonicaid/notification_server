The connectors folder includes classes to manage the different ways to connect with a node

* connector_ws: The connection is done through an open WebSocket
* connector_udp: The connection is done by closing the websocket and pinging the IP and port given by the client

connector_base defines the connector interface and implements a dummy one
