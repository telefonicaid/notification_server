echo "Removing all data from the Mongo DB"
mongo push_notification_server --eval "db.apps.remove(); db.nodes.remove(); db.messages.remove()"
echo "Done !"
