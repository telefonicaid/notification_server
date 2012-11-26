Mozilla PUSH Notification server [![Build Status](https://secure.travis-ci.org/telefonicaid/notification_server.png)](http://travis-ci.org/telefonicaid/notification_server/)
===

## Authors:

- Andreas Gal (gal @ mozilla . com)
- Fernando Rodríguez Sela (frsela @ tid . es)
- Thinker Li (tlee @ mozilla . com)
- Guillermo Lopez Leal (gll @ tid . es)

## Introduction

The objective of this Push server is to reduce the battery comsuption & network traffic avoiding keep-alive messages.
The server could be allocated inside the MNO private network with two network interfaces:

* To connect with user handset
* To connect from Internet

## API for third party developers

#### Register device
    -> GET https://NSurl/token
    -> Open WebSocket to the same origin as above
    -> Send registerUA message through that WS
    <- 200 OK
    -> RegisterWA
    <- 200 OK || 4xx ERROR, reason

#### Send notification

    -> POST https://publicURL/notify/APPtoken
        with a JSON
    <- 200 OK || 4xx ERROR, reason

#### Receive notification:
    <- (Through the WS): A JSON.

## Documentation
It's on [a wiki page](https://github.com/telefonicaid/notification_server/wiki/_pages), but that doesn't mean that it's updated. We are working on a document.

## Requirements / Dependencies
* [Node.JS (>= 0.8.x)](http://nodejs.org/)
* [MongoDB (>= 2.2.x)](http://www.mongodb.org/)
* [RabbitMQ (>= 2.8.x)](http://www.rabbitmq.com/) (with AMQP protocol active)

### Node.JS Modules (```npm install <module>```)
* [node-uuid (1.3.x)](https://github.com/broofa/node-uuid)
* [websocket (1.0.x)](https://github.com/Worlize/WebSocket-Node)
* [mongodb (1.2.x)](https://github.com/mongodb/node-mongodb-native)
* [node-amqp (0.1.x)](https://github.com/postwait/node-amqp)
* [forever-monitor (1.0.x)](https://github.com/nodejitsu/forever-monitor)
