Mozilla PUSH Notification server [![Build Status](https://secure.travis-ci.org/telefonicaid/notification_server.png)](http://travis-ci.org/telefonicaid/notification_server/) [![Dependency Status](https://david-dm.org/telefonicaid/notification_server.png)](https://david-dm.org/telefonicaid/notification_server)
===

## Introduction

The objective of this Push server is to reduce the battery comsuption & network traffic avoiding keep-alive messages.
The server could be allocated inside the MNO private network with two network interfaces:

* To connect with user handset
* To connect from Internet

## Documentation
It's on [a wiki page](https://github.com/telefonicaid/notification_server/wiki/_pages), but that doesn't mean that it's updated. We are working on a document.

## Requirements / Dependencies
* [Node.JS (>= 0.8.x)](http://nodejs.org/)
* [MongoDB (>= 2.2.x)](http://www.mongodb.org/)
* [RabbitMQ (>= 2.8.x)](http://www.rabbitmq.com/) (with AMQP protocol active)
