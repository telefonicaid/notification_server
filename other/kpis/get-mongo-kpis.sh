#!/bin/bash
LOG_FILE="$0.log"
MYSQL_HOST="172.20.232.208"
	MYSQL_USER="kpi"
MYSQL_PASS="kpi-pass"
DATABASE="kpis-db"
LOG_WS="/var/log/push_server/NS_UA_WS.log"
LOG_WS="./NS_UA_WS.log"
LOG_AS="/var/log/push_server/NS_UA_WS.log"
LOG_UDP="/var/log/push_server/NS_UA_WS.log"
LOG_MON="/var/log/push_server/NS_UA_WS.log"
MONGO_BIN="/usr/bin/mongo --quiet"
MONGO_HOST="localhost"
PORT=30000
NO_PROCESADO="/root/kpis-no-procesados"
MYSQL_USER="kpis"
MYSQL_PASS="push"
DATABASE="kpisdb"





 log() {
  echo "[`date +%Y%m%d-%H:%M:%S`] $1"
  echo "[`date +%Y%m%d-%H:%M:%S`] $1" >> $LOG_FILE
}


dump_data_to_mysql()
{
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

fi
}


}


FILE=KPIs
TAM_RABBIT=0
TAM_MONGO=0
MEM=0
CPU=0
OUTPUT_FILE="/tmp/host-kpi.txt"


#kpi=1
isMaster(){
	master=`echo "db.isMaster()"| mongo localhost:10000 | grep ismaster|awk -F ":" '{print $2}' | cut -f 1 -d ,`
	echo $master
	[ $master == "false" ] && return 0 ||return 1

	}



kpi_num_terminales()
{
	rm $OUTPUT_FILE
	host="`hostname`"
	query="db.nodes.count()"
	slaving="rs.slaveOk()"
	#$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "printjson($slaving)"
	terminal=`$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "db.getMongo().setSlaveOk();printjson($query)"`
	fecha_unix=`date +%s`
	
	log "Terminales: $terminal Fecha: $fecha_datetime "
	echo "insert into mongo_num_terminales values ('$host','$fecha_unix',$terminal);">>$OUTPUT_FILE
	dump_data_to_mysql $OUTPUT_FILE


}

kpi_num_apps()
{
	rm $OUTPUT_FILE

	query="db.apps.count()"
	fecha_unix=`date +%s`

	slaving="rs.slaveOk()"
	#$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "printjson($slaving)"
	apps=`$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "db.getMongo().setSlaveOk();printjson($query)"`
	log "Aplicaciones: $apps Fecha: $fecha_unix"
	echo "insert into mongo_num_apps values ('$host','$fecha_unix',$apps);">>$OUTPUT_FILE
	 dump_data_to_mysql $OUTPUT_FILE


}



kpi_activas()
{
	rm $OUTPUT_FILE
	#dias=`date --date="1 days ago" +%Y-%m-%dT%H:%M:%S.000Z`
	dias=`date -u --date="10 days ago" +%Y-%m-%dT%H:%M:%S.000Z`
	now=`date +%Y-%m-%dT%H:%M:%S.000Z`
	#echo $dias
	#echo $now
	#query="db.nodes.find({ lt: {\$gt: ISODate(\"2013-07-31T12:40:00.000Z\") }}).count()"
	#query="db.nodes.find({ lt: {\$gt: ISODate(\"$dias\") }}).count()"
	query="db.nodes.find({ lt: {\$gte: ISODate(\"$dias\")}}).count()"
	#echo $query
	# db.nodes.find({ lt: {$gt: ISODate("2013-07-31T11:58:01.000Z"), $lt: ISODate("2013-07-31T11:60:11.000Z") }}).count()

	slaving="rs.slaveOk()"
	#$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "printjson($slaving)"
	data="$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval \"db.getMongo().setSlaveOk();printjson($query)\""

	#echo $data
	activas=`$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "db.getMongo().setSlaveOk();printjson($query)"`
	log "conexiones activas $activas"
	fecha_unix=`date +%s`
	echo "insert into mongo_terminales_activos values ('$host','$fecha_unix',$activas);">>$OUTPUT_FILE
        dump_data_to_mysql $OUTPUT_FILE

	

}

kpi_combinados()
{
        rm $OUTPUT_FILE
        #dias=`date --date="1 days ago" +%Y-%m-%dT%H:%M:%S.000Z`
        dias=`date -u --date="3 days ago" +%Y-%m-%dT%H:%M:%S.000Z`
        now=`date +%Y-%m-%dT%H:%M:%S.000Z`
        #echo $dias
        #echo $now
        #query="db.nodes.find({ lt: {\$gt: ISODate(\"2013-07-31T12:40:00.000Z\") }}).count()"
        #query="db.nodes.find({ lt: {\$gt: ISODate(\"$dias\") }}).count()"
        query_activas="db.nodes.find({ lt: {\$gte: ISODate(\"$dias\")}}).count()"
	query_terminales="db.nodes.count()"
	query_canales="db.apps.count()"
        slaving="rs.slaveOk()"
        #$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "printjson($slaving)"
        data_activas="$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval \"db.getMongo().setSlaveOk();printjson($query_activas)\""
        data_terminales="$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval \"db.getMongo().setSlaveOk();printjson($query_terminales)\""
        data_canales="$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval \"db.getMongo().setSlaveOk();printjson($query_canales)\""

        #echo $data
        activas=`$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "db.getMongo().setSlaveOk();printjson($query_activas)"`
        terminales=`$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "db.getMongo().setSlaveOk();printjson($query_terminales)"`
        canales=`$MONGO_BIN $MONGO_HOST:$PORT/push_notification_server  --eval "db.getMongo().setSlaveOk();printjson($query_canales)"`
        log "$activas $terminales $canales"
	
        fecha_unix=`date +%s`
        echo "insert into mongo_combinados values ('$fecha_unix',$activas,$terminales,$canales);">>$OUTPUT_FILE
        dump_data_to_mysql $OUTPUT_FILE



}




#MAIN
#system_data

#	fecha_sys=`date +%a' '%b' '%d' '%Y' '%H:%M`
#	fecha_ini=`date --date='30 min ago' +%a' '%b' '%d' '%Y' '%H:%M`
#	lineas=`sed -n "/$fecha_ini/ , /$fecha_sys/p" NS_UA_WS.log`
#lineas=`cat NS_UA_WS.log`
#kpi_peticiones_registro "$lineas"
echo "-----------------------------------------------------------------"
#isMaster
mkdir -p $NO_PROCESADO
#valor=$?
valor=0
if [ $valor -eq 0 ]; then 
	echo es esclavo.Procedemos
#	kpi_num_terminales
#	kpi_num_apps
#	kpi_activas
	kpi_combinados

else
echo "es master. salimos"
fi
exit

