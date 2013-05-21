echo "Adding a new network to the MongoDB"
mongo push_notification_server --quiet --eval "db.operators.update( { _id: '$1-$2' }, { \$push: { networks: '$3' } } )"
echo "Done !"
