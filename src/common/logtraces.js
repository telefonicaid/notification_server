/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

/**
 * Log traces IDs format (per digit):
 *  1: Log level (1=NOTIFY, 2=ERROR, 3=CRITICAL)
 *  2: Server (0=COMMON, 1=AS, 2=MONITOR, 3=UAWS, 4=UAUDP, 5=WakeUp)
 *  3 & 4: Message ID
 */

exports.logtraces = {

  // NOTIFY TRACES

  NOTIFY_MSGREMOVEDDB: {
    id: 0x1001,
    m: "datastore::removeMessage --> Message removed from MongoDB ::messageId",
    doc: "Message correctly removed from the database"
  },
  NOTIFY_MSGACKED: {
    id: 0x1002,
    m: "datastore::ackMessage --> Message ACKed",
    doc: "Message correctly delivered and removed from Database"
  },
  NOTIFY_APPTOKEN_VERSION: {
    id: 0x1101,
    m: "appToken=::appToken -- version=::version",
    doc: "Information about the application token and version"
  },
  NOTIFY_MSGSTORINGDB: {
    id: 0x1102,
    m: "Storing message for the '::apptoken' apptoken. Internal Id: ::id",
    doc: "Storing message on database"
  },
  NOTIFY_MSGINSERTEDINTOQUEUE: {
    id: 0x1203,
    m: "MSG_mon::onNodeData --> Notify into the messages queue of node ::serverId # ::messageId"
  },
  NOTIFY_MSGSENTTOUA: {
    id: 0x1301,
    m: "Message with id ::messageId sent to ::uaid"
  },
  NOTIFY_NOTIFINGNODE: {
    id: 0x1401,
    m: "Notifying node: ::uaid to ::wakeupip:::wakeupport on network ::mcc-::mnc and using protocol ::protocol",
    doc: "Sending a wakeup package to the wakeup specified host"
  },
  NOTIFY_RECEIVEDREQUESTFORURL: {
    id: 0x1501,
    m: "NS_WakeUp::onHTTPMessage --> Received request for ::url"
  },
  NOTIFY_WAKEUPPACKAGEFAILED: {
    id: 0x1502,
    m: "WakeUp TCP packet to ::ip:::port - FAILED"
  },
  NOTIFY_WAKEUPPACKAGEOK: {
    id: 0x1503,
    m: "WakeUp TCP packet succesfully sent to ::ip:::port"
  },
  NOTIFY_WAKEUPPACKAGEUDPDGRAMSENT: {
    id: 0x1504,
    m: "WakeUp Datagram sent to ::ip:::port"
  },

  // ERROR TRACES

  ERROR_BACKENDERROR: {
    id: 0x2000,
    m: "::class::::method --> ::extra, FIX YOUR BACKEND"
  },

  ERROR_DSERROROPENINGNODESCOLLECTION: {
    id: 0x2001,
    m: "datastore::::method --> There was a problem opening the nodes collection --> ::error"
  },
  ERROR_DSERROROPENINGAPPSCOLLECTION: {
    id: 0x2002,
    m: "datastore::::method --> there was a problem opening the apps collection --> ::error"
  },
  ERROR_DSERROROPENINGOPERATORSCOLLECTION: {
    id: 0x2003,
    m: "datastore::::method --> There was a problem opening the operators collection --> ::error"
  },
  ERROR_DSERROROPENINGMESSAGESCOLLECTION: {
    id: 0x2004,
    m: "datastore::::method --> There was a problem opening the messages collection --> ::error"
  },


  ERROR_DSERRORINSERTINGNODEINDB: {
    id: 0x2005,
    m: "datastore::registerNode --> Error inserting/updating node into MongoDB -- ::error"
  },
  ERROR_DSERRORINSERTINGAPPINDB: {
    id: 0x2006,
    m: "datastore::registerApplication --> Error inserting application into MongoDB: ::error"
  },
  ERROR_DSERRORINSERTINGMSGTONODE: {
    id: 0x2007,
    m: "dataStore::::method --> Error inserting message to node: ::error"
  },

  ERROR_DSERRORREMOVINGNODE: {
    id: 0x2008,
    m: "dataStore::unregisterNode --> There was a problem removing the node: ::error"
  },
  ERROR_DSERRORREMOVINGXXXCOLLECTION: {
    id: 0x2009,
    m: "datastore::flushDb --> There was a problem removing the ::collection collection: ::error"
  },
  ERROR_DSERRORREMOVINGMESSAGE: {
    id: 0x200A,
    m: "dataStore::removeMessage --> Error removing message: ::error"
  },

  ERROR_DSERRORFINDINGCERTIFICATE: {
    id: 0x200B,
    m: "datastore::::method --> There was a problem finding the certificate - ::error"
  },
  ERROR_DSERRORFINDINGNODE: {
    id: 0x200C,
    m: "datastore::getNodeData --> Error finding node into MongoDB: ::error"
  },
  ERROR_DSERRORFINDINGAPPS: {
    id: 0x200D,
    m: "datastore::getApplicationsForUA --> Error finding applications from MongoDB: ::error"
  },
  ERROR_DSERRORFINDINGAPP: {
    id: 0x200E,
    m: "datastore::getApplication --> Error finding application from MongoDB: ::error"
  },
  ERROR_DSERRORFINDINGMSG: {
    id: 0x200F,
    m: "datastore::getAllMessagesForUA --> There was a problem finding the message: ::error"
  },
  ERROR_DSERRORLOCATINGCHANNEL4APPTOKEN: {
    id: 0x2010,
    m: "dataStore::::method --> Error locating channel for appToken: ::apptoken"
  },

  ERROR_DSNOTENOUGHNODESINFO: {
    id: 0x2011,
    m: "dataStore::unregisterApplication --> Not enough nodes info to pull from nodes collection :("
  },

  ERROR_DSERRORREMOVINGOLDVERSION: {
    id: 0x2012,
    m: "dataStore::newVersion --> Error removing old version for appToken: ::apptoken"
  },
  ERROR_DSERRORSETTINGNEWVERSION: {
    id: 0x2013,
    m: "dataStore::newVersion --> Error setting new version for appToken: ::apptoken"
  },

  ERROR_DSERRORACKMSGINDB: {
    id: 0x2014,
    m: "dataStore::ackMessage --> Error ACK\'ing message into MongoDB: ::error"
  },

  ERROR_DSUNDETERMINEDERROR: {
    id: 0x2016,
    m: "dataStore::::method --> Some error occured --> ::error"
  },

  ERROR_MBERRORBROKERDISCONNECTED: {
    id: 0x2017,
    m: "msgbroker::queue --> one message broker disconnected!!!"
  },
  ERROR_MBCONNECTIONERROR: {
    id: 0x2018,
    m: "msgbroker::queue.onerror --> There was an error in one of the connections: ::error"
  },

  ERROR_NOSERVERPROVIDED: {
    id: 0x2019,
    m: "No server provided"
  },
  ERROR_ERROR_RECVKILLSIGNAL: {
    id: 0x201A,
    m: "Received kill (9 or 15) signal"
  },
  ERROR_WORKERERROR: {
    id: 0x201B,
    m: "worker ::pid closed unexpectedly with code ::code"
  },
  ERROR_ULIMITERROR: {
    id: 0x201C,
    m: "ulimit error: ::error"
  },

  ERROR_MOBILENETWORKERROR: {
    id: 0x201D,
    m: "[MobileNetwork] --> error!! ::error"
  },

  ERROR_MONBADJSON: {
    id: 0x2201,
    m: "MSG_mon::onNewMessage --> newMessages queue recieved a bad JSON. Check"
  },
  ERROR_MONBADMSGTYPE: {
    id: 0x2202,
    m: "MSG_mon::onNewMessage --> Bad msgType: ::json"
  },
  ERROR_MONERROR: {
    id: 0x2203,
    m: "MSG_mon::onApplicationData --> There was an error"
  },

  ERROR_CONNECTORERRORGETTINGOPERATOR: {
    id: 0x2301,
    m: "getConnector --> Error getting the operator from the DB: ::error"
  },

  ERROR_DMERRORGETTINGCONNECTION: {
    id: 0x2302,
    m: "dataManager::registerNode --> Error getting connection object"
  },
  ERROR_DMERRORUNREGISTERUA: {
    id: 0x2303,
    m: "dataManager::unregisterNode --> There was a problem unregistering the uaid ::uaid"
  },
  ERROR_WSNODATA: {
    id: 0x2305,
    m: "WS::queue::onNewMessage --> Not enough data!"
  },
  ERROR_WSERRORGETTINGNODE: {
    id: 0x2307,
    m: "WS::onWSMessage::getPendingMessages --> There was an error getting the node"
  },
  ERROR_WSNOCHANNELS: {
    id: 0x2308,
    m: "WS::onWSMessage::getPendingMessages --> No channels for this node."
  },
  CRITICAL_WSERRORULIMIT: {
    id: 0x2309,
    m: "WS:init --> Ulimit too low, please, raise the value"
  },

  ERROR_CONNECTORERRORNOTVALID: {
    id: 0x2401,
    m: "Connector UDP: Notify to ::wakeupip not valid with this connector"
  },

  ERROR_UDPNODATA: {
    id: 0x2402,
    m: "UDP::queue::onNewMessage --> Not enough data to find server"
  },
  ERROR_UDPERRORGETTINGOPERATOR: {
    id: 0x2403,
    m: "UDP::queue::onNewMessage --> Error getting the operator from the DB: ::error"
  },
  ERROR_UDPBADADDRESS: {
    id: 0x2404,
    m: "UDP:queue:onNewMessage --> Bad address to notify ::address"
  },

  ERROR_WAKEUPPROTOCOLNOTSUPPORTED: {
    id: 0x2501,
    m: "Protocol not supported !"
  },

  ERROR_CASDIRECTORYUNDEFINED: {
    id: 0x2502,
    m: "CAs directory undefined!"
  },

  ERROR_NOCADEFINED: {
    id: 0x2503,
    m: "CAs directory empty or doesn't exists. "
  },


  // CRITICAL TRACES

  CRITICAL_DBCONNECTIONERROR: {
    id: 0X3001,
    m: "::class::::method --> Error connecting to MongoDB ! - ::error"
  },
  CRITICAL_MBDISCONNECTED: {
    id: 0X3002,
    m: "::class::::method --> MsgBroker DISCONNECTED!!'"
  },
  CRITICAL_DBDISCONNECTED: {
    id: 0X3003,
    m: "::class::::method --> DataStore DISCONNECTED!!'"
  },
  CRITICAL_NOTREADY: {
    id: 0X3004,
    m: "30 seconds has passed and we are not ready, closing'"
  },
  CRITICAL_WSINTERFACESNOTCONFIGURED: {
    id: 0X3301,
    m: "NS_UA_WS interfaces not configured'"
  }

}
