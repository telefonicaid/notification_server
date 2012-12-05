#!/bin/bash
openssl genrsa 1024 > private.key
openssl rsa -in private.key -out public.pem -outform PEM -pubout
openssl pkcs8 -topk8 -nocrypt -outform DER < private.key > private.pk8
