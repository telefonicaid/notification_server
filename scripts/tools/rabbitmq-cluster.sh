#!/bin/sh

# This script runs a cluster of rabbitmq instances.
# It starts two nodes: one in memory (RAM) and other in disk.
# Then names are "rabbit" and "hare" in localhost, listening in ports 5672 and 5673
# Management consoles are in localhost:{55672,55673}
RABBITMQ_NODE_PORT=5672 RABBITMQ_SERVER_START_ARGS="-rabbitmq_mochiweb listeners [{mgmt,[{port,55672}]}]" RABBITMQ_NODENAME=rabbit rabbitmq-server -detached
RABBITMQ_NODE_PORT=5673 RABBITMQ_SERVER_START_ARGS="-rabbitmq_mochiweb listeners [{mgmt,[{port,55673}]}]" RABBITMQ_NODENAME=hare rabbitmq-server -detached
rabbitmqctl -n hare stop_app
rabbitmqctl -n hare reset
rabbitmqctl -n hare cluster rabbit@`hostname -s`
rabbitmqctl -n hare start_app
