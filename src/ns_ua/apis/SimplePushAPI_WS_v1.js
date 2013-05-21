/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */
var log = require('../../common/logger.js'),
    token = require('../../common/token.js'),
    helpers = require('../../common/helpers.js'),
    dataManager = require('../datamanager.js'),
    errorcodes = require('../../common/constants').errorcodes.GENERAL,
    errorcodesWS = require('../../common/constants').errorcodes.UAWS,
    statuscodes = require('../../common/constants').statuscodes,
    counters = require('../../common/counters');

module.exports = function(message, connection) {
  connection.res = function responseWS(payload) {
    log.debug('WS::responseWS:', payload);
    var res = {};
    if (payload && payload.extradata) {
      res = payload.extradata;
    }
    if (payload && payload.errorcode[0] > 299) {    // Out of the 2xx series
      if (!res.status) {
        res.status = payload.errorcode[0];
      }
      res.reason = payload.errorcode[1];
    }
    connection.sendUTF(JSON.stringify(res));
  };

  if (message.type === 'utf8') {
    log.debug('WS::onWSMessage --> Received Message: ' + message.utf8Data);
    var query = {};
    try {
      query = JSON.parse(message.utf8Data);
    } catch (e) {
      log.debug('WS::onWSMessage --> Data received is not a valid JSON package');
      connection.res({
        errorcode: errorcodesWS.NOT_VALID_JSON_PACKAGE
      });
      return connection.close();
    }

    //Check for uaid in the connection
    if (!connection.uaid && query.messageType !== 'hello') {
      log.debug('WS:onWSMessage --> No uaid for this connection');
      connection.res({
        errorcode: errorcodesWS.UAID_NOT_FOUND,
        extradata: { messageType: query.messageType }
      });
      connection.close();
      return;
    }

    // Restart autoclosing timeout
    dataManager.getNode(connection.uaid, function(nodeConnector) {
      if(nodeConnector)
        nodeConnector.resetAutoclose();
    });

    function getPendingMessages(cb) {
      cb = helpers.checkCallback(cb);
      log.debug('WS::onWSMessage::getPendingMessages --> Sending pending notifications');
      dataManager.getNodeData(connection.uaid, function(err, data) {
        if (err) {
          log.error(log.messages.ERROR_WSERRORGETTINGNODE);
          return cb(null);
        }
        // In this case, there are no nodes for this (strange, since it was just registered)
        if (!data || !data.ch || !Array.isArray(data.ch)) {
          log.error(log.messages.ERROR_WSNOCHANNELS);
          return cb(null);
        }
        var channelsUpdate = [];
        data.ch.forEach(function(channel) {
          if (channel.vs) {
            channelsUpdate.push({
              channelID: channel.ch,
              version: channel.vs
            });
          }
        });
        if (channelsUpdate.length > 0) {
          cb(channelsUpdate);
        }
      });
    }

    switch (query.messageType) {
      case undefined:
        log.debug('WS::onWSMessage --> PING package');
        setTimeout(function() {
          getPendingMessages(function(channelsUpdate) {
            if (!channelsUpdate) {
              return connection.sendUTF('{}');
            }
            connection.res({
              errorcode: errorcodes.NO_ERROR,
              extradata: {
                messageType: 'notification',
                updates: channelsUpdate
              }
            });
          });
        });
        break;

      /*
        {
          messageType: "hello",
          uaid: "<a valid UAID>",
          channelIDs: [channelID1, channelID2, ...],
          wakeup_hostport: {
            ip: "<current device IP address>",
            port: "<TCP or UDP port in which the device is waiting for wake up notifications>"
          },
          mobilenetwork: {
            mcc: "<Mobile Country Code>",
            mnc: "<Mobile Network Code>"
          }
        }
       */
      case 'hello':
        if (!query.uaid || !token.verify(query.uaid)) {
          query.uaid = token.get();
          query.channelIDs = null;
          counters.inc('tokensGenerated');
        }
        log.debug('WS:onWSMessage --> Theorical first connection for uaid=' + query.uaid);
        log.debug('WS:onWSMessage --> Accepted uaid=' + query.uaid);
        connection.uaid = query.uaid;

        // New UA registration
        log.debug('WS::onWSMessage --> HELLO - UA registration message');
        //query parameters are validated while getting the connector in
        // connectors/connector.js
        dataManager.registerNode(query, connection, function onNodeRegistered(error, res, data) {
          if (error) {
            connection.res({
              errorcode: errorcodesWS.FAILED_REGISTERUA,
              extradata: { messageType: 'hello' }
            });
            log.debug('WS::onWSMessage --> Failing registering UA');
            return;
          }
          connection.res({
            errorcode: errorcodes.NO_ERROR,
            extradata: {
              messageType: 'hello',
              uaid: query.uaid,
              status: (data.canBeWakeup ? statuscodes.UDPREGISTERED : statuscodes.REGISTERED)
            }
          });

          // If uaid do not have any channelIDs (first connection), we do not launch this processes.
          if (query.channelIDs && Array.isArray(query.channelIDs)) {
            //Start recovery protocol
            setTimeout(function recoveryChannels() {
              log.debug('WS::onWSMessage::recoveryChannels --> Recovery channels process: ', query.channelIDs);
              query.channelIDs.forEach(function(ch) {
                log.debug("WS::onWSMessage::recoveryChannels CHANNEL: ", ch);

                var appToken = helpers.getAppToken(ch, connection.uaid);
                dataManager.registerApplication(appToken, ch, connection.uaid, null, function(error) {
                  if (!error) {
                    var notifyURL = helpers.getNotificationURL(appToken);
                    log.debug('WS::onWSMessage::recoveryChannels --> OK registering channelID: ' + notifyURL);
                  } else {
                    log.debug('WS::onWSMessage::recoveryChannels --> Failing registering channelID');
                  }
                });
              });
            });

            //Start sending pending notifications
            setTimeout(function() {
              getPendingMessages(function(channelsUpdate) {
                log.debug("CHANNELS: ",channelsUpdate);
                if (!channelsUpdate) {
                  return;
                }
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    messageType: 'notification',
                    updates: channelsUpdate
                  }
                });
              });
            });
          }
          log.debug('WS::onWSMessage --> OK register UA');
        });
        break;

      /**
        {
          messageType: "register",
          channelId: <channelId>
        }
       */
      case 'register':
        log.debug('WS::onWSMessage::register --> Application registration message');

        // Close the connection if the channelID is null
        var channelID = query.channelID;
        if (!channelID || typeof(channelID) !== 'string') {
          log.debug('WS::onWSMessage::register --> Null channelID');
          connection.res({
            errorcode: errorcodesWS.NOT_VALID_CHANNELID,
            extradata: {
              messageType: 'register'
            }
          });
          //There must be a problem on the client, because channelID is the way to identify an app
          //Close in this case.
          return connection.close();
        }

        // Register and store in database
        log.debug('WS::onWSMessage::register uaid: ' + connection.uaid);
        var appToken = helpers.getAppToken(channelID, connection.uaid);
        dataManager.registerApplication(appToken, channelID, connection.uaid, null, function(error) {
          if (!error) {
            var notifyURL = helpers.getNotificationURL(appToken);
            connection.res({
              errorcode: errorcodes.NO_ERROR,
              extradata: {
                messageType: 'register',
                status: statuscodes.REGISTERED,
                pushEndpoint: notifyURL,
                'channelID': channelID
              }
            });
            log.debug('WS::onWSMessage::register --> OK registering channelID');
          } else {
            connection.res({
              errorcode: errorcodes.NOT_READY,
              extradata: {
                'channelID': channelID,
                messageType: 'register'
              }
            });
            log.debug('WS::onWSMessage::register --> Failing registering channelID');
          }
        });
        break;

      /**
        {
          messageType: "unregister",
          channelId: <channelId>
        }
       */
      case 'unregister':
        // Close the connection if the channelID is null
        var channelID = query.channelID;
        log.debug('WS::onWSMessage::unregister --> Application un-registration message for ' + channelID);
        if (!channelID || typeof(channelID) !== 'string') {
          log.debug('WS::onWSMessage::unregister --> Null channelID');
          connection.res({
            errorcode: errorcodesWS.NOT_VALID_CHANNELID,
            extradata: {
              messageType: 'unregister'
            }
          });
          //There must be a problem on the client, because channelID is the way to identify an app
          //Close in this case.
          return connection.close();
        }

        var appToken = helpers.getAppToken(query.channelID, connection.uaid);
        dataManager.unregisterApplication(appToken, connection.uaid, function(error) {
          if (!error) {
            var notifyURL = helpers.getNotificationURL(appToken);
            connection.res({
              errorcode: errorcodes.NO_ERROR,
              extradata: {
                channelID: query.channelID,
                messageType: 'unregister',
                status: statuscodes.UNREGISTERED
              }
            });
            log.debug('WS::onWSMessage::unregister --> OK unregistering channelID');
          } else {
            if (error == -1) {
              connection.res({
                errorcode: errorcodesWS.NOT_VALID_CHANNELID,
                extradata: { messageType: 'unregister' }
              });
            } else {
              connection.res({
                errorcode: errorcodes.NOT_READY,
                extradata: { messageType: 'unregister' }
              });
            }
            log.debug('WS::onWSMessage::unregister --> Failing unregistering channelID');
          }
        });
        break;

      /**
        {
            messageType: “ack”,
            updates: [{"channelID": channelID, “version”: xxx}, ...]
        }
       */
      case 'ack':
        if(!Array.isArray(query.updates)) {
          connection.res({
            errorcode: errorcodesWS.NOT_VALID_CHANNELID,
            extradata: { messageType: 'ack' }
          });
          connection.close();
          return;
        }

        query.updates.forEach(function(el) {
          if (!el.channelID || typeof el.channelID !== 'string' ||
              !el.version || !helpers.isVersion(el.version)) {
            connection.res({
              errorcode: errorcodesWS.NOT_VALID_CHANNELID,
              extradata: { messageType: 'ack',
                           channelID: el.channelID,
                           version: el.version}
            });
            return;
          }

          dataManager.ackMessage(connection.uaid, el.channelID, el.version);
        });
        break;

      default:
        log.debug('WS::onWSMessage::default --> messageType not recognized');
        connection.res({
          errorcode: errorcodesWS.MESSAGETYPE_NOT_RECOGNIZED
        });
        return connection.close();
    }
  } else if (message.type === 'binary') {
    // No binary data supported yet
    log.debug('WS::onWSMessage --> Received Binary Message of ' + message.binaryData.length + ' bytes');
    connection.res({
      errorcode: errorcodesWS.BINARY_MSG_NOT_SUPPORTED
    });
    return connection.close();
  }
};
