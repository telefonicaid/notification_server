/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2013 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

/**
 * Log traces IDs format (per digit):
 *  1: Log level (1=NOTIFY,)
 *  2: Server (0=COMMON, 1=AS, 2=MONITOR, 3=UAWS, 4=UAUDP, 5=WakeUp)
 *  3 & 4: Message ID
 */

exports.logtraces = {
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
  }
}
