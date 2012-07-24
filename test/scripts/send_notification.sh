curl -d "{ \"id\": 1234, \"message\": \"$2\", \"signature\": \"$3\", \"ttl\": 0, \"timestamp\": \"SINCE_EPOCH_TIME\", \"priority\": 1 }" http://karanka2.hi.inet:80/notify/$1
