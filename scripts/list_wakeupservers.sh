echo "Listing WakeUp server"
mongo push_notification_server --quiet --eval "JSON.stringify(db.operators.find( { 'wakeup': { \$ne: null } } ).toArray())"
echo "Done !"
