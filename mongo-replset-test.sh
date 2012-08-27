#!/bin/bash

# @see https://github.com/cronnelly/mongo-replset-test
# @see http://clock.co.uk/tech-blogs/scaling-nodejs-and-mongodb-on-joyent-cloud

# dateInfo=`date --rfc-3339=seconds|sed s/\ /_/g`
dateInfo=`date +%Y-%m-%d--%H-%M-%S|sed s/\ /_/g`
baseDir=/tmp/mongo-replset-test-$dateInfo
startPort=$1
numServers=$2
endPort=$(($startPort + $numServers - 1))
replSetName=$3
killCommand="kill"

if [ -z $replSetName ]
then
	echo "Usage: $0 <StartPort> <NumServers> <SetName>"
	exit
fi

echo "* Starting $numServers MongoDB instances under $baseDir..."

mkdir -v $baseDir

count=0
configString="{_id: \"$replSetName\", members: ["
for (( p=$startPort; p<=$endPort; p++ ))
do
	mkdir -v $baseDir/$p
	mongod --replSet "$replSetName" --logpath "$baseDir/$p/mongodb.log" --dbpath "$baseDir/$p" \
		--rest --bind_ip 127.0.0.1 --port $p --noauth --noprealloc --nojournal &
	killCommand="$killCommand $!"
	configString=$configString"{_id: $count, host: \"127.0.0.1:$p\"},"
	count=$(($count + 1))
done
configString=$configString"]}"

echo "Waiting a few seconds for daemons to start..."
sleep 5
echo "rs.initiate($configString);" | mongo --host 127.0.0.1 --port $startPort

echo
echo "* Done. Use the following command to kill the daemons, and clean up /tmp:"
echo "$killCommand"
echo "rm -r $baseDir"
echo
echo "* View replica set status at this URL, or by running this command:"
echo "http://127.0.0.1:"$(($startPort + 1000))"/_replSet"
echo "echo \"rs.status();\" | mongo --host 127.0.0.1 --port $startPort"
