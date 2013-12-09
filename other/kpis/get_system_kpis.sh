#!/bin/bash
LOG_FILE="$0.log"
 log() {
  echo "[`date +%Y%m%d-%H:%M:%S`] $1"
  echo "[`date +%Y%m%d-%H:%M:%S`] $1" >> "$LOG_FILE"
}
MYSQL_HOST="172.20.232.208"
FILE=KPIs
TAM_RABBIT=0
TAM_MONGO=0
MEM=0
CPU=0
NO_PROCESADO="/home/operaciones/kpis-no-procesados"
MYSQL_USER="kpis"
MYSQL_PASS="push"
DATABASE="kpisdb"



dump_data_to_mysql()
{
file_inserts="$1"
inserciones=`cat "$file_inserts"|wc -l `
log "lineas a insertar:$inserciones"
mysql --host=kpis --user=$MYSQL_USER --password=$MYSQL_PASS $DATABASE -e "show tables" >/dev/null
mysql_OK=$?
log "valor de ok:$mysql_OK"
if [ "$mysql_OK" -eq 0 ]; then
        log "status mysql Ok"
                if [ -f $file_inserts ]; then
                    mysql --host=$MYSQL_HOST --user=$MYSQL_USER --password=$MYSQL_PASS $DATABASE <$file_inserts
                    log "fin insertar"
                else
                    log "no hay datos que insertar"
            fi
else
    #copiamos el fichero a $NO_POCESADO
    fich="no-procesado-$RANDOM-`date +%s`.txt"
    cp $file_inserts $NO_PROCESADO/$fich
    chown -R operaciones.operaciones /home/operaciones

fi

}
 
 system_data()
 {
     log "Inicio system data"
     MEM=`vmstat -n 1 1|tail -1|awk '{print $4}'`
     CPU=`vmstat -n 1 1|tail -1|awk '{print $13}'`
     disco_opt=`df -m|grep /opt|awk '{print $3}'`
     disco_root=`df -m|grep /root|awk '{print $3}'`
     disco_home=`df -m|grep /home|awk '{print $3}'`
     disco_tmp=`df -m|grep /tmp|awk '{print $3}'`
     disco_var=`df -m|grep "/var$" |awk '{print $3}'`
     disco_var_log=`df -m|grep "/var/log$"|awk '{print $3}'`
     if [ -d /var/lib/nas ]; then
          disco_nas=`df -m|grep /nas|awk '{print $3}'`;echo "insert into sistema values ('$host','$fecha',\"disco_nas\",'$disco_nas');">>$outputfile
      fi
host="`hostname`"
outputfile="$host.txt"
fecha="`date +%Y-%m-%d' '%H:%M:%S`"
echo "insert into sistema values ('$host','$fecha',\"CPU\",'$CPU');">$outputfile
echo "insert into sistema values ('$host','$fecha',\"MEM\",'$MEM');">>$outputfile
echo "insert into sistema values ('$host','$fecha',\"disco_root\",'$disco_opt');">>$outputfile
echo "insert into sistema values ('$host','$fecha',\"disco_home\",'$disco_home');">>$outputfile
echo "insert into sistema values ('$host','$fecha',\"disco_tmp\",'$disco_tmp');">>$outputfile
echo "insert into sistema values ('$host','$fecha',\"disco_var\",'$disco_var');">>$outputfile
echo "insert into sistema values ('$host','$fecha',\"disco_var_log\",'$disco_var_log');">>$outputfile
dump_data_to_mysql $outputfile
log "Fin system data"

                                                                                               }

rabbit_data()
{
   log "Inicio rabbit data"

   #`/usr/bin/which rabbitmqctl 2>&1 >/tmp/rabbitout`
   `ls /var/lib/rabbitmq >/dev/null`
   is_rabbit_node=$?
   if [ $is_rabbit_node -eq 0 ]; then
   outputfile="$host.txt"

   #TAM_RABBIT=`/usr/sbin/rabbitmqctl list_queues memory|egrep -v '(Listing|\.\.)'|awk '{s+=$1}END{print s}'`
      TAM_RABBIT=`/usr/sbin/rabbitmqctl list_queues name memory|grep new |awk '{print $2}'`

   echo "insert into sistema values ('$host','$fecha',\"New_messages_queue\",'$TAM_RABBIT');">$outputfile
   dump_data_to_mysql $outputfile
       log "Fin irabbit data"

       fi
}
mongo_data()
{
$TAM_MONGO=0
log "mongo inserts"
outputfile="$host.txt"
log "----$outputfile"
`ls /var/lib/mongo >/dev/null`
is_mongo_node=$?
if [ $is_mongo_node -eq 0 ]; then
log "entramos"
TAM_MONGO=0
TAM_MONGO=`df -m |awk '/lib\/mongo/ {print $2}'|tr -d 'G'`

log "$TAM_MONGO"
echo "insert into sistema values ('$host','$fecha',\"disco_var_lib_mongo\",$TAM_MONGO);">>$outputfile
dump_data_to_mysql $outputfile

fi
log "mongo inserts end"
}
host=`hostname`
mkdir -p $NO_PROCESADO

system_data
rabbit_data
mongo_data
