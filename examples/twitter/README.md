Twitter streamer sample - PUSH Notification server

===

## Authors:

- Fernando Rodríguez Sela (frsela @ tid . es)

## Introduction

This sample shows a simple client which receives tweets async using the PUSH platform.

The server connects to Twitter and streams all tweets which contains a pre-configurated string

### About the clients

As you can see, we offer two different clients, the native and non-native.
What's the difference?

- The native is using the navigator.mozPush API but you need a gecko platform which supports this.
- The non-native, implements all the websocket protocol at webapp level, so it connects directly with the notification server.

```For the non-native one you need to setup the push server address on the push.js. By default is localhost.```

## Requirements / Dependencies
* [Node.JS (>= 0.8.x)](http://nodejs.org/)

### Node.JS Modules (```npm install <module>```)
* [twit (1.0.11)](https://github.com/ttezel/twit)
