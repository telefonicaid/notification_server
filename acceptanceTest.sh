#!/bin/bash
cd /opt/pdi/owd/push_server/test
resultado=$(node E2Etest.js)

if [ "$resultado" = "" ]; then
  echo "Todo correcto"
else
  echo "Error: $resultado"
  exit 1
fi
