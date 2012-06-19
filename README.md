Mozilla PUSH Notification server.
===

### Authors:

- Andreas Gal (gal @ mozilla . com)
- Fernando Rodríguez Sela (frsela @ tid . es)
- Thinker Li (tlee @ mozilla . com)
- Guillermo Lopez Leal (gll @ tid . es)

### Introduction

The main objective is to reduce the battery comsuption & network traffic avoiding keep-alive messages.
So the server shall be allocated inside the MNO private network with two network interfaces:

* To connect with user handset
* To connect from Internet

Diagram:

    Handset       NotificationServer      WebSite
    -------       ------------------      -------
    |                    |                    |
    | register(token,ip) |                    |
    |------------------->|                    |
    | Ok (publicURL)     |                    |
    |<-------------------|                    |
    |                    |                    |
    | GET: JS API        |                    |
    |---------------------------------------->|
    |  200 OK            |                    |
    |<----------------------------------------|
    |                    |                    |
    | AJAX: register(publicURL, publicKey)    |
    |---------------------------------------->|
    |                    |                    |
    |                    | notif(origin, data)|
    |                    |<-------------------|
    |                    | verifyOrigin       |
    |                    |------------------->|
    | notfy(origin, data)|                    |
    |<-------------------|                    |
    |                    |                    |
    | ACK (OPTIONAL)     |                    |
    |---------------------------------------->|
    |                    |                    |
    |                    |                    |
    |                    |                    |



## Notification server API

 PRIVATE INTERFACE

    -> GET https://privateURL/register?token=uuid[&ip=address]
    <- 200 OK "REGISTERED&publicURL=https://publicURL/notify/token"
    <- 200 OK "NOTIFY ORIGIN DATA"

 PUBLIC INTERFACE

    -> POST https://publicURL/notify/token?data=xxxx
    <- 200 OK
    <- verifyOrigin: GET https://websiteOriginURL
    (validate certificate)

## Requirements / Dependencies
* Node.JS
* MongoDB
* ActiveMQ or RabbitMQ (should support STOMP protocol)

### Node.JS Modules (```npm install <module>```)
* node-uuid
* websocket
* mongodb --mongodb:native
* stomp
