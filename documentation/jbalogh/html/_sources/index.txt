Push Notifications
==================

.. highlight:: js

This document provides a reference to the push notification server.


Components
==========

``paster serve etc/push-dev.ini``
  The main HTTP API server. This is a Pyramid app that stores the mappings for
  push URLs to users. When a new notification comes in, it is stored in queuey
  and published to the router for WebSocket distribution.

``python router.py etc/push-dev.ini``
  The pubsub broker between the HTTP server and the WebSocket server.
  Notifications come in from the HTTP server and are published out to all
  WebSocket servers.

``python websockets.py etc/push-dev.ini``
  The WebSocket server. Each server holds open connections to many users.
  Notifications are published to all WebSocket servers; each server picks out
  and delivers messages to its connected users.

``python monitor.py etc/push-dev.ini``
  A daemon that monitors the status of the WebSocket servers. The number of
  connections each WebSocket is holding open is stored in the database. If the
  monitor can't connect to a server, it removes it from the database so no new
  WebSocket connections are directed there.


.. digraph:: components

  "HTTP API" -> Router -> WebSockets -> Firefox;
  Monitor -> WebSockets;


An Example
==========

Clients are identified on the push server as an opaque string of characters. If
our Firefox has this token::

    token = abc123

...and `facebook.com` asks us to allow push notifications, Firefox will request a
new push URL for `facebook.com`.

.. code-block:: none

    POST https://push.mozilla.org/queue/

    domain=facebook.com&token=abc123

The API server will create a new queue and return a URL like:

.. code-block:: none

    https://push.mozilla.org/queue/xyz

Facebook stores this URL on their backend, associated with our user account.

When that URL is created, the push server maps the queue token to our user
token::

    queues_to_users = {"xyz": "abc123"}

When Facebook sends us a notification

.. code-block:: none

    POST https://push.mozilla.org/queue/xyz/
    Content-Type: application/json

    {"title": "Thanks for using Facebook."}

...the push server looks up the user token for that queue and delivers the
notification to us.


Public API
==========

.. http:method:: POST /queue/{queue}/
    :label-name: notify

    Send a new notification. This is how third-party sites send notifications
    to users. The URLs are created through the
    ``navigator.notification.requestRemotePermission()`` API.

    :pparam title: Primary text of the notification.
    :pparam body: Secondary text of the notification.
    :pparam actionUrl: URL to be opened if the user clicks on the notification.
    :pparam replaceId: A string which identifies a group of like
        messages. If the user is offline, only the last message with the same
        replaceId will be sent when the user comes back online.

    ``title`` is the only required parameter.

    The data can be posted as ``application/json`` or
    ``application/x-www-form-urlencoded``.

    Example request:

    .. code-block:: none

        POST https://push.mozilla.org/queue/5116f9fd4/
        Content-Type: application/x-www-form-urlencoded

        title=message+one&body=hi

    or

    .. code-block:: none

        POST https://push.mozilla.org/queue/5116f9fd4/
        Content-Type: application/json

        {"title": "message one", "body": "hi"}


Client HTTP API
===============


The client (e.g. Firefox) is responsible for managing push URLs,
reading/streaming messages, and syncing device state.


.. http:method:: POST /token/
    :label-name: token

    Create a new authentication token. This token is used to identify the
    client in all other requests.

    Example response::

       {"token": "TOKEN",
        "queue": "https://push.mozilla.org/queue/TOKEN/"}

    The ``token`` is a randomly generated string that should be stored and kept
    secret by the client. The ``queue`` is a URL where the client can check for
    new messages over HTTP.


.. http:method:: POST /queue/

    Create a new queue for the given ``token`` and ``domain``.

    :pparam token: The client token created by :http:method:`token`.
    :pparam domain: The domain of the site creating the queue.

    Example response::

        {"queue": "https://push.mozilla.org/queue/QUEUE"}

    The ``queue`` URL is given to the third-party site to send notifications to
    the user.


.. http:method:: GET /queue/?token={token}

    Get all of the user's queues. This can be used for syncing state between
    clients.

    :param token: The client token created by :http:method:`token`.

    Example response::

        {"example.org": "https://push.mozilla.org/queue/QUEUE1",
         "micropipes.com": "https://push.mozilla.org/queue/QUEUE2"}

    The object keys are domains and the values are push URLs.


.. http:method:: DELETE /queue/{queue}/?token={token}

    Delete a queue. The user will no longer receive messages from the site once
    this push URL is destroyed.

    :param token: The client token created by :http:method:`token`.


.. http:method:: POST /queue/{queue}/?action=read&key={key}
    :label-name: mark-read

    Mark a message as read.

    :pparam key: message key extracted from notification metadata.

    This will only work on queues created in :http:method:`token`, i.e. the
    queue directly tied to the user token.


.. http:method:: GET /queue/{queue}/

    Get all the stored messages for the queue.

    :optparam since: Only return messages newer than this timestamp or message
      key.  Should be formatted as seconds since epoch in GMT, or the
      hexadecimal message key.

    Example response::

        {"messages": [
            {
                "key": "4ae183428d8e11e1a007109add558619",
                "timestamp": "1335217807.899117",
                "queue": "https://push.mozilla.org/queue/5116f9fd48d3c792d0d93df93d889fa3bfada77f",
                "body": {
                    "title": "message one",
                    "body": "hi"
                }
            },
            {
                "key": "4ae417618d8e11e193d7109add558619",
                "timestamp": "1335217807.916016",
                "queue": "https://push.mozilla.org/queue/5116f9fd48d3c792d0d93df93d889fa3bfada77f",
                "body": {
                    "title": "message two",
                    "body": "hi"
                }
            },
        ]}


.. http:method:: GET /nodes/
    :label-name: nodes

    Get a list of WebSocket server ``IP:port`` addresses.

    Example response::

        {"nodes": ["63.245.217.105:8000",
                   "63.245.217.105:9000",
                   "63.245.217.106:8000"]

    To make a WebSocket connection the client should attempt to connect to each
    address in the order provided.


Client WebSocket API
====================

After connecting to one of the addresses given in :http:method:`nodes`, the
client must authenticate::

    >>> token: TOKEN

Following authentication the client listens for messages published from the
server.

New messages will come down the WebSocket in either the
:ref:`new message <new-message>` or :ref:`read message <read-message>` format.


Message Formats
===============

Messages are stored on the server and can be retrieved over HTTP or through a
WebSocket connection. The format of a single message is the same over either
protocol.

.. _new-message:

New Message
-----------

New messages coming from the server have the following format::

    {
        "key": "4ae183428d8e11e1a007109add558619",
        "timestamp": "1335217807.899117"
        "queue": "https://push.mozilla.org/queue/5116f9fd48d3c792d0d93df93d889fa3bfada77f",
        "body": {
            "title": "message one",
            "body": "hi",
            "actionUrl": "http://example.com/action",
            "replaceId": "one"
        }
    }

The outer layer describes metadata created by the server, with the actual
notification inside the ``body`` element.

key
  string identifier for the message
timestamp
  message creation time formatted as seconds since epoch in GMT
queue
  push URL that the message was sent to (:http:method:`notify`)
body
  the message created in :http:method:`notify`


.. _read-message:

Read Message
------------

When a client marks a notification as :http:method:`read <mark-read>` a new
message is pushed onto the user's queue in this format::

    {
        "key": "4b89c48a8d8e11e18db6109add558619",
        "queue": "https://push.mozilla.org/queue/5116f9fd48d3c792d0d93df93d889fa3bfada77f",
        "timestamp": "1335217809.001793",
        "body": {
            "read": "4ae183428d8e11e1a007109add558619"
        }
    }

The outer layer is the same as the :ref:`new message format <new-message>`.

The ``body`` differs in that it contains a single key ``read``, with a value
that points to the ``key`` of a previous message.
