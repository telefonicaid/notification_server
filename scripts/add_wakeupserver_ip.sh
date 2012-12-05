echo "Adding a new WakeUp server IP address to the MongoDB"
mongo push_notification_server --quiet --eval "db.operators.update( { _id: '$1-$2' }, { \$set: { wakeup: '$3' } } )"
echo "Done !"
