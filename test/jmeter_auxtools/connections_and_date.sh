#!/bin/bash

echo `netstat -utan | grep 8080 | wc -l` "," `date +"%H:%M:%S %d/%m/%y"`

sleep 10
