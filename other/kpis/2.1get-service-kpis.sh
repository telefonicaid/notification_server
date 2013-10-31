#!/bin/bash
LOG_FILE="$0.log"

MYSQL_HOST="172.20.232.208"
MYSQL_USER="kpis"
MYSQL_PASS="push"
DATABASE="kpisdb"
LOG_WS="/var/log/push_server/NS_UA_WS.log.1"
LOG_AS="/var/log/push_server/NS_AS.log.1"
LOG_UDP="/var/log/push_server/NS_UA_UDP.log.1"
LOG_MON="/var/log/push_server/NS_Monitor.log.1"
NO_PROCESADO="/root/kpis-no-procesados"

 log() {
  echo "[`date +%Y%m%d-%H:%M:%S`] $1"

  echo "[`date +%Y%m%d-%H:%M:%S`] $1" >> $LOG_FILE
}

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

fi
}


FILE=KPIs
TAM_RABBIT=0
TAM_MONGO=0
MEM=0
CPU=0
OUTPUT_FILE="/tmp/host-kpi.txt"
#kpi=1
 host="`hostname`"

kpi_peticiones_registro(){
        cadena="Hello message"
	TABLA="peticiones_registros"
	log "Buscamos la cadena $cadena....."
	lineas=$1
	HOST=$2
   sed "s/.*{.*(\([^)]\+\)...)}.*$cadena.*uaid=\([^ ]\+\).*mcc=\([^ ]\+\).*mnc=\([^ ]\+\).*/insert into $TABLA values('$HOST',\1,'\2','\3','\4');/;tx;d;:x" $lineas >>$OUTPUT_FILE

dump_data_to_mysql $OUTPUT_FILE


}
#kpi=2
kpi_canales_registrados(){
        cadena="Register message"
        log "Buscamos la cadena $cadena....."
        lineas=$1
        HOST=$2
	TABLA="canales_registrados"
 sed "s/.*{.*(\([^)]\+\)...)}.*$cadena.*uaid=\([^ ]\+\).*channelID=\([^ ]\+\).*appToken=\([^ ]\+\).*/insert into $TABLA values('$HOST',\1,'\2','\3','\4');/;tx;d;:x" $lineas>>$OUTPUT_FILE
dump_data_to_mysql $OUTPUT_FILE

}



kpi_canales_desregistrados(){
        cadena="Unregister message"
        log "Buscamos la cadena $cadena....."
        lineas=$1
        HOST=$2
        TABLA="canales_registrados"
 sed "s/.*{.*(\([^)]\+\)...)}.*Register message.*uaid=\([^ ]\+\).*channelID=\([^ ]\+\).*appToken=\([^ ]\+\).*/insert into $TABLA values('$HOST',\1,'\2','\3','\4');/;tx;d;:x" $lineas>>$OUTPUT_FILE
dump_data_to_mysql $OUTPUT_FILE
}

kpi_notificaciones_WS(){
        cadena="ACK received"
        log "Buscamos la cadena $cadena....."
        lineas=$1
        HOST=$2
        TABLA="notificaciones_ws"
	sed "s/.*{.*(\([^)]\+\)...)}.*$cadena.*uaid=\([^ ]\+\).*channelID=\([^ ]\+\).*appToken=\([^ ]\+\).*/insert into $TABLA values('$HOST',\1,'\2','\3','\4');/;tx;d;:x"  $lineas>>$OUTPUT_FILE
dump_data_to_mysql $OUTPUT_FILE
}
###################NS_AS
kpi_notificaciones_entrantes(){
        cadena="New version"
        log "Buscamos la cadena $cadena....."
        lineas=$1
        HOST="$2"
	TABLA="notificaciones_entrantes"
sed "s/.*{.*(\([^)]\+\)...)}.*$cadena.*appToken=\([^ ]\+\).*version=\([^ ]\+\).*ip=\([0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}.*\)/insert into $TABLA values('$HOST',\1,'\2','\3','\4');/;tx;d;:x"  $lineas>>$OUTPUT_FILE

     dump_data_to_mysql $OUTPUT_FILE
}


kpi_notificaciones_monitor(){
        cadena="New version for"
        log "Buscamos la cadena $cadena....."
        lineas=$1
        HOST="$2"
        TABLA="notificaciones_monitor"
sed "s/.*{.*(\([^)]\+\)...)}.*$cadena.*uaid=\([^ ]\+\).*appToken=\([^ ]\+\).*version=\([^ ]\+\).*mcc=\([^ ]\+\).*mnc=\([^ ]\+\).*/insert into $TABLA values('$HOST',\1,'\2','\3','\4','\5','\6') ;/;tx;d;:x" $lineas>>$OUTPUT_FILE
 

        dump_data_to_mysql $OUTPUT_FILE

}

kpi_notificaciones_udp(){
        cadena="Notify to wakeup"
        log "Buscamos la cadena $cadena....."
    lineas=$1
        while read line; do
                value=`echo $line| grep "$cadena" |wc -l`
                if [ $value -gt 0 ]; then
                        fecha=`echo $line|awk -F '] - {' '{print $2 }'|awk -F 'GMT+' '{print $1 }'`
			uaid=`echo "$line"|sed -n 's/^.*.\(uaid=\).\([[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*.[@].[[:alnum:]]*.\).*/\2/p'`
                        mcc="`echo $line| grep -o \"mcc=[0-9]*\"`"
                        mnc="`echo $line| grep -o \"mnc=[0-9]*\"`"
			echo $mnc
                        dump_data_to_mysql "$uaid" "$fecha" "$mcc" "$mnc"
                fi
        done <<< "$lineas"
}

############################################
############################################
############################################
kpi_numero_registros(){
# Hello message -- uaid=9a18d768-2e95-4120-9baa-5f19c00099b1@34807e0ed867046f2a07f1a3eea45c43f1d7aa60 -- mcc=0 -- mnc=0
lineas=$1
echo $trozo
var=`echo "$trozo"|sed -n 's/^.*.\("uaid":"\).\([[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*.[@].[[:alnum:]]*.\)[."].*/\1=>\2/p' `
echo "$var"
echo "$var"|wc -l
unico=`sed -n 's/^.*.\("uaid":"\).\([[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*-[[:alnum:]]*.[@].[[:alnum:]]*.\)[."].*/\1=>\2/p' /var/log/push_server/NS_UA_WS.log|sort|uniq -c|wc -l`
echo $unico



}

#MAIN
#system_data
mkdir -p $NO_PROCESADO
rm $OUTPUT_FILE 2>&1 >/dev/null
	fecha_sys=`date +%a' '%b' '%d' '%Y' '%H:%M`
	#fecha_ini=`date --date='1 day ago' +%a' '%b' '%d' '%Y' '%H:%M`
	fecha_ini=`date --date='10 min ago' +' '%b' '%d' '%Y' '%H:`
	fecha_ini_2=`date --date='5 min ago' +%H:%M`
	fecha_sys_2=`date +%H:%M`

	fecha_sys=`date +' '%b' '%d' '%Y' '%H:`
	
	echo $fecha_ini
	#lineas=`sed -n "/$fecha_ini/ , /$fecha_sys/p" $LOG_WS`
#sed -n "/Aug 06 2013 13:/ , /Aug 06 2013 13:59/p" /var/log/push_server/NS_UA_WS.log|more


TIPO="`ps -ef|grep \"node main.js\"|grep -v grep|awk '{print $10}'`"
case $TIPO in
	NS_UA_WS)
	
		echo $TIPO
                rm $OUTPUT_FILE
		kpi_peticiones_registro "$LOG_WS" `hostname`
		rm $OUTPUT_FILE
		kpi_canales_registrados "$LOG_WS" `hostname`
		rm $OUTPUT_FILE
		kpi_canales_desregistrados  "$LOG_WS" `hostname` 
		rm $OUTPUT_FILE
		kpi_notificaciones_WS  "$LOG_WS" `hostname`
		;;
	NS_AS)
		echo $TIPO
                rm $OUTPUT_FILE
		kpi_notificaciones_entrantes "$LOG_AS" `hostname`
		;;
	NS_MSG_monitor)
		echo $TIPO
                rm $OUTPUT_FILE
		kpi_notificaciones_monitor "$LOG_MON" `hostname`

		;;
	NS_UA_UDP)
		echo $TIPO
		#lineasUDP=`sed -n "/Aug 08 2013 04:/ , /Aug 08 2013 05:/p"  $LOG_UDP`
		;;
		
esac
log "-----------------------------------------------------------------"
