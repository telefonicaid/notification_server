#!/bin/bash
cd /opt/pdi/owd/push_server/test/functions
resultado=$(node E2E.js)

if [ "$resultado" = "" ]; then
  echo "Todo correcto"
else
  echo "Error: $resultado"
  exit 1
fi
