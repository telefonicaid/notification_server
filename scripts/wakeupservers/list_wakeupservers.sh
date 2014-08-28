echo "Listing WakeUp servers (don't show crypto info...)"
mongo push_notification_server --quiet --eval "JSON.stringify(db.wakeup.find({}, {_id: true, n: true, st: true, wu:true, v: true}).toArray())"
echo "Done !"
