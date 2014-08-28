echo "Adding a new wakeup platform to the MongoDB"

if [ $# -lt 5 ]; then
  echo "Parameters: <Name/Description> <Base URL> <Protocol Version> <Key> <Certificate> <CA>"
  exit 1
fi

echo "Adding $1 WakeUp service at $2 (version $3) ..."
echo "Key file $4"
echo "Certificate file $5"
echo "CA Certificate file $6"
STATUSURL="$2/netinfo/v$3"
echo "Check status URL = $STATUSURL"
WUURL="$2/wakeup/v$3"
echo "WakeUp URL = $WUURL"

mongo push_notification_server --quiet --eval "db.wakeup.insert( { name: '$1', status: '$STATUSURL', wakeup: '$WUURL', version: $3, key: cat('$4'), crt: cat('$5'), ca: cat('$6') } )"
echo "Done !"
