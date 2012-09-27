TIMESTAMP=`date +%s`

curl -k -d "{ \"messageType\": \"notification\",
		   \"id\": 1234,
		   \"message\": \"$2\",
		   \"signature\": \"$3\",
		   \"ttl\": 0,
		   \"timestamp\": \"$TIMESTAMP\",
		   \"priority\": 1
		}" $1
