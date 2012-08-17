#!/bin/bash
lista="node activemq mongod"
echo $lista
for I in $lista 
do
   resultado=$(ps ax | grep $I | grep -v grep | awk '{print $1}')
     if [ "$resultado" = "" ]; then
         echo $I is not currently running
         exit 1
     fi
done
