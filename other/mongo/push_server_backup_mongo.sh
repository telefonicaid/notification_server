#!/bin/bash
#######################
## Script para la realización automatica de un backup de mongo en replicaset
## autor: ftroitino@hi-iberia.es
## TID
#######################

ME=$(readlink -e $0 )
BINDIR=$(dirname  $ME )
MYNAME=$(basename $0 )
SSHOPTIONS="$PSSSHOPTIONS -o PasswordAuthentication=no"
comando="rs.status()['myState']"

## Variables
PATH_BBDD_MONGO=/var/lib/mongo
BACKUP_LOGICO=no
BACKUP_FISICO=yes
OPLOG=no
PATH_BACKUP=/tmp/backup/
MONGO_LOCAL=/home/ftroitino/Documentos/TID/RM/mongodb-linux-x86_64-2.0.1/bin/mongo
MONGO_REMOTO=/usr/bin/mongo
MONGODUMP_REMOTO=/usr/bin/mongodump
mongos="psrmmongo psrmmongo2"





#Define and create the directories where everything will be stored
TMPDIR=/tmp/PSMongoDBBackup.$$.$RANDOM
OUTPUT_FILE=$PATH_BACKUP/BackupMongoDB_$(uname -n)_$(date +%Y%m%d%H%M%S).tgz

export EXPLODIR=BackupMongoDB.$(uname -n).$(date +%Y%m%d%H%M%S)
BASEDIR=$TMPDIR/$EXPLODIR

Checks()
{
for I in $PATH_BBDD_MONGO $PATH_BACKUP 
do
 result_=$(ssh root@${HOST} "[ -d $I ] || echo 'NOK'")
 if [ "$result_" = "NOK" ]
 then
   reportError "No exite el path: $I on $HOST."
   exit 1
 fi
done
}


createjs()
{

  Ejecutor "echo \"if (rs.status()['myState'] == 1) { rs.stepDown(); }\" > $BASEDIR/js/secundary.js"

}


secundary () 
{

  Ejecutor "time $MONGO_REMOTO admin --quiet $BASEDIR/js/secundary.js 2> $BASEDIR/log/rs.stepdown.err"

}
backup_logico () {

report "Realizando el backup logico"

Ejecutor "time $MONGODUMP_REMOTO $PARAM_OPLOG -o $BASEDIR/logical 2> $BASEDIR/log/mongodump.err"

return 0
}

backup_fisico () {

report "Realizando el backup fisico"

Ejecutor "echo \"db.runCommand({fsync:1,lock:1});\" | $MONGO_REMOTO admin --quiet 2> $BASEDIR/log/fsync.err"


Ejecutor "time rsync -avz --exclude _tmp --exclude journal --delete $PATH_BBDD_MONGO $BASEDIR/physical 2> $BASEDIR/log/rsyn.err"

Ejecutor " echo \"db.fsyncUnlock();\"| $MONGO_REMOTO admin --quiet 2> $BASEDIR/log/fsyncUnlock.err"

}

function report ()
{
 if [ "$1" != "" ]
 then
    Now=`date +"%d-%m-%Y %H:%M:%S"`
    echo -e "$Now - $*"
 fi
}

function reportError ()
{
  Now=$(date +"%d-%m-%Y %H:%M:%S")
  echo -e "\n\t*********** ERROR ($Now) ***************"
  echo -e "$1"
  echo -e "\t*********** ERROR ($Now) ***************\n"
}

function reportWarn ()
{


  Now=$(date +"%d-%m-%Y %H:%M:%S")
  echo -e "\n\t*********** WARNING ($Now) ***************"
  echo -e "$1"
  echo -e "\t*********** WARNING ($Now) ***************\n"

}

function Ejecutor ()
{

  if [ $# != 1 ]
  then
    report "\n\Ejecutor function needs 1 parameters" 
    return
  fi
  report "Ejecutando: ssh root@${HOST} $1" 
  result_ejecutor=$(ssh root@${HOST} "$1")
  RESULT=$?
  if [ $RESULT != 0 ]
  then
    reportError "ERROR: $0: Executing $1 on $HOST."
  fi
  report $result_ejecutor
}



######################
#
# MAIN
#
######################

if [ "$BACKUP_FISICO" != "yes" ]
then
   if [ "$BACKUP_LOGICO" != "yes" ]
   then
       exit -1
   fi
fi

for mongo in $mongos 
do
  resultado=$(echo $comando | $MONGO_LOCAL $mongo:27017/admin --quiet |grep -v bye)
  if [ "$resultado" = "2" ]
  then
     report "El $mongo es SECUNDARY"
     HOST=$mongo
  else
     if [ "$resultado" = "1" ]
     then
        report "El $mongo es PRIMARY"
     else
        if [ "$resultado" = "3" ]
        then
            reportWarn "El $mongo es RECOVERING (Warning)"
        else
            reportWarn "WARNING: El $mongo es $resultado"
        fi   
     fi
  fi
done


if [ "$HOST" = "" ]
then
   reportError "No se puede seleccionar ningun mongo para realizar el backup"
   exit 1
fi

ERROR=0
FAILEDHOSTS=""
ssh $SSHOPTIONS root@${HOST} ":" 
if [ $? != 0 ]
then
    report "ERROR: $0: Problems connecting to $HOST. Root must have access using private key"
    ERROR=$(( $ERROR + 1 ))
    FAILEDHOSTS="$FAILEDHOSTS $HOST"
fi
[ $ERROR = 0 ] || reportError "ERROR: $0: Problems connecting to hosts $FAILEDHOSTS. Leaving" $ERROR


for SUBDIR in logical physical log js
do
  
  Ejecutor "mkdir -p $BASEDIR/${SUBDIR}"

done

Checks

createjs

secundary


if [ "$BACKUP_LOGICO" = "yes" ]
then
        if [ "$OPLOG" = "yes" ]
        then
             PARAM_OPLOG=--oplog
        fi
	backup_logico
fi
if [ "$BACKUP_FISICO" = "yes" ]
then
        backup_fisico
fi

# Pack everything and clean the temp space used
Ejecutor "( cd $TMPDIR && tar czvf $OUTPUT_FILE ${EXPLODIR} ) || exit $?"
Ejecutor "rm -rf $TMPDIR"
