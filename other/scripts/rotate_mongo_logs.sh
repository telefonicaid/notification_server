#!/bin/bash
MONGO_BIN="/usr/bin/mongo --verbose"
MONGO_HOST="localhost"
PORT1=10000
PORT2=20000
PORT3=11000
PORT4=30000
LOG_FILE="/var/log/mongo/log-rotado.log"

 log() {
   echo "[`date +%Y%m%d-%H:%M:%S`] $1"
     echo "[`date +%Y%m%d-%H:%M:%S`] $1" >> $LOG_FILE
     }


log "Inicio de rotado..."
#shardings
if [ -f /etc/mongo/shard*.conf ]; then
    log "rotado de la replica"
    $MONGO_BIN $MONGO_HOST:$PORT1/admin  --eval "printjson(db.runCommand( { logRotate : 1 } ))" 
    [ "$?" -eq 0 ] && log "Rotado de replica OK" || log "Error rotando replica"  
fi
#config_servers
if [ -f "/etc/mongo/config_server.conf" ]; then
    log "rotado del config_server"
    $MONGO_BIN $MONGO_HOST:$PORT2/admin  --eval "printjson(db.runCommand( { logRotate : 1 } ))" 
    [ "$?" -eq 0 ] && log "Rotado de config server OK" || log "Error rotando config_server" 
fi
#arbitros
if [ -f "/etc/mongo/arbiter.conf" ]; then
    log "rotado de arbitro"
    $MONGO_BIN $MONGO_HOST:$PORT3/admin  --eval "printjson(db.runCommand( { logRotate : 1 } ))" 
    [ "$?" -eq 0 ] && log "Rotado de arbitro OK" || log "Error rotando arbitro" 
fi
#mongos
if [ -f "/etc/mongos.conf" -o  "/etc/mongo/mongos.conf" ]; then
    log "rotado de los mongos"
    $MONGO_BIN $MONGO_HOST:$PORT4/admin  --eval "printjson(db.runCommand( { logRotate : 1 } ))" 
    [ "$?" -eq 0 ] && log "Rotado de mongos OK" || log "Error rotando mongos" 
fi



    # Compress rotated log file

    OLD_LOG=`ls -rt /var/log/mongo/cluster/*.log.*`
    OLD_LOG2=`ls -rt /var/log/mongo/*.log.*`
    /bin/gzip $OLD_LOG
    /bin/gzip $OLD_LOG2
    # Delete old log files
    find /var/log/mongo/ -type f -mtime +3 -exec rm -f {} \;
    log "Fin de rotado"

