#!/usr/bin/python -O

import requests
post_data = '{"messageType": "notification", "id": 1234, "message": "hola", "signature": "", "ttl": 0, "timestamp": "SINCE_EPOCH_TIME", "priority": 1}'

for x in xrange(1, 100000000):
    try:
        print x
        post_response = requests.post(url='http://localhost:8081/notify/d5856351bbc14599e687dac105150e8a919b21477f3c00386405228caac1e43a', data=post_data)
    except Exception, e:
        pass
