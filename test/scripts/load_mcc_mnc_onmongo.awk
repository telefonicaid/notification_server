# AWK Script to parse the MCC-MNC table obtained from: http://www.itu.int/pub/T-SP-E.212B-2011
# -> You should export the table to TXT file from FreeOffice ;)
# (c) Telefonica Digital, 2012 - All rights reserved
# Fernando Rodríguez Sela <frsela at tid dot es>

# Use: awk -f load_mcc_mnc_onmongo.awk mcc_mnc_list.txt

function mongo(cmd) {
  if(execute_mongo == 1) {
    command = "mongo push_notification_server --quiet --eval \"" cmd "\""
    debug("[DB] " command)
    system(command)
  } else {
    printf("%s\n", cmd)
  }
}

function debug(msg) {
  if(debug_enabled == 1) {
    printf(" * %s\n", msg)
  }
}

BEGIN {
  debug_enabled = 0
  execute_mongo = 1   # Execute mongo command or only print into screen

  printf("MCC & MNC import tool for the Telefonica Digital notification server\n")
  printf("(c) Telefonica Digital, 2012 - All rights reserved\n\n")
  FS = "\t"
  mongo("db.operators.drop()")
  complete_line = 0
  operators_count = 0
}

{
  # Skip first 5 lines
  if(NR <= 5) {
    debug("Skipping line " NR)
    next
  }

  if($1 != "") {
    country = $1 $2 $3 $4 $5
    sub("'", "\\'", country)
  }
  if($2 != "") {
    if($2+0 != $2) {
      operator = $1 $2 $3 $4 $5
      sub("'", "\\'", operator)
    } else {
      mcc = $2
    }
  }
  if($3 != "" && $3+0 == $3) {
    mnc = $3
    complete_line = 1
  }

  if(complete_line == 1) {
    mongo("db.operators.insert({ _id: '" mcc "-" mnc "', country: '" country "', operator: '" operator "', mcc: '" mcc "', mnc: '" mnc "' })")
    complete_line = 0
    operators_count++
    if(debug_enabled == 0 && execute_mongo == 1) {
      printf(".");
    }
  }
}

END {
  printf("\n\nProcessed %d lines and %d operators\n", NR, operators_count)
  if(execute_mongo == 1) {
    printf("Rows inserted: ")
    mongo("db.operators.count()")
  }
  printf("\n\nFinished.\n");
}
