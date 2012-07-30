#!/usr/bin/python -O

import requests
post_data = '{"id": 1234, "message": "hola", "signature": "", "ttl": 0, "timestamp": "SINCE_EPOCH_TIME", "priority": 1}'

for x in xrange(1, 100000000):
    try:
        print x
        post_response = requests.post(url='http://localhost:8081/notify/hola', data=post_data)
    except Exception, e:
        pass
