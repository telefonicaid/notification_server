TIMESTAMP=`date +%s`

curl --cert $3 --key $4 -k -d "{ \"messageType\": \"notification\",
		   \"id\": 1234,
		   \"message\": \"$2\",
		   \"ttl\": 0,
		   \"timestamp\": \"$TIMESTAMP\",
		   \"priority\": 1
		}" $1
