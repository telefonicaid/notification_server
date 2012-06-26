curl -d "{ \"id\": 1234, \"message\": \"$2\", \"signature\": \"SHA256_RSA Signature\", \"ttl\": 0, \"timestamp\": \"SINCE_EPOCH_TIME\", \"priority\": 1 }" http://localhost:8081/notify/$1
