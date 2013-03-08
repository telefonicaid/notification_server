curl -k -d "{ \"wakeup\": {
			    \"interface\": {
					\"ip\": \"$2\",
					\"port\": \"$3\"
				},
				\"mobilenetwork\": {
					\"mcc\": \"$4\",
					\"mnc\": \"$5\"
				}
			  }
		    }" $1
