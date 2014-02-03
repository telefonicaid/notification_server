Mozilla PUSH Notification server [![Build Status](https://secure.travis-ci.org/telefonicaid/notification_server.png)](http://travis-ci.org/telefonicaid/notification_server/) [![Dependency Status](https://david-dm.org/telefonicaid/notification_server.png)](https://david-dm.org/telefonicaid/notification_server)
===

## Introduction

The objective of this Push server is to reduce the battery comsuption & network traffic avoiding keep-alive messages.
The server could be allocated inside the MNO private network with two network interfaces:

* To connect with user handset
* To connect from Internet

## Documentation
It's on [Github Pages](http://frsela.github.io/notification_server_doc/), but that doesn't mean that it's updated. We are working on continously on it.

## Requirements / Dependencies
* [Node.JS (>= 0.10.x)](http://nodejs.org/)
* [MongoDB (>= 2.4.x)](http://www.mongodb.org/)
* [RabbitMQ (>= 3.2.x)](http://www.rabbitmq.com/) (using AMQP 0.9)
