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
    if (payload.extradata) {
      res = payload.extradata;
    }
    if (payload.errorcode[0] > 299) {    // Out of the 2xx series
      if (!res.status) {
        res.status = 'ERROR';
      }
      res.reason = payload.errorcode[1];
    } else {
      if (!res.status) {
        res.status = 'OK';
      }
    }
    connection.sendUTF(JSON.stringify(res));
  };

  if (message.type === 'utf8') {
    log.debug('WS::onWSMessage --> Received Message: ' + message.utf8Data);
    if (message.utf8Data == 'PING') {
      return connection.sendUTF('PONG');
    }
    var query = null;
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

    switch (query.messageType) {
      /*
        {
          messageType: "hello",
          uaid: "<a valid UAID>",
          channelIDs: [channelID1, channelID2, ...],
          interface: {
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

          // Recovery channels process
          if (query.channelIDs && Array.isArray(query.channelIDs)) {
            setTimeout(function recoveryChannels() {
              log.debug('WS::onWSMessage::recoveryChannels --> Recovery channels process: ', query);
              // TODO sync channels with client
            });
          }

          // Pending notifications process
          setTimeout(function pendingNotifications() {
            log.debug('WS::onWSMessage::pendingNotifications --> Sending pending notifications');
            dataManager.getNodeData(query.uaid, function(err, data) {
              if (err) {
                return;
              }
              var channelsUpdate = [];
              for (x in data.ch) {
                if (data.ch[x].vs) {
                  channelsUpdate.push({
                    channelID: data.ch[x].ch,
                    version: data.ch[x].vs
                  })
                }
              }
              if (channelsUpdate.length > 0) {
                connection.res({
                  errorcode: errorcodes.NO_ERROR,
                  extradata: {
                    messageType: 'notification',
                    updates: channelsUpdate
                  }
                });
              }
            });
          });
          log.debug('WS::onWSMessage --> OK register UA');
        });

        //onNodeRegistered.bind(connection));
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
        if (!channelID) {
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
        appToken = helpers.getAppToken(channelID, connection.uaid);
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

      case 'registerEx':
        log.debug('WS::onWSMessage::register --> Extended Application registration message');

        // Close the connection if the watoken is null
        var watoken = query.watoken;
        if (!watoken) {
          log.debug('WS::onWSMessage::register --> Null WAtoken');
          connection.res({
            errorcode: errorcodesWS.NOT_VALID_WATOKEN,
            extradata: { messageType: 'register' }
          });
          //There must be a problem on the client, because WAtoken is the way to identify an app
          //Close in this case.
          connection.close();
        }

        var certUrl = query.certUrl;
        if(!certUrl && query.pbkbase64) {
          certUrl = query.pbkbase64;
        }
        if (!certUrl) {
          log.debug('WS::onWSMessage::registerWA --> Null certificate URL');
          //In this case, there is a problem, but there are no certificate.
          //We just reject the registration but we do not close the connection
          return connection.res({
            errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
            extradata: {
              'watoken': watoken,
              messageType: 'registerWA'
            }
          });
        }

        // Recover certificate
        var certUrl = url.parse(certUrl);
        if (!certUrl.href || !certUrl.protocol ) {
          log.debug('WS::onWSMessage::registerWA --> Non valid URL');
          //In this case, there is a problem, but there are no certificate.
          //We just reject the registration but we do not close the connection
          return connection.res({
            errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
            extradata: {
              'watoken': watoken,
              messageType: 'registerWA'
            }
          });
        }
        // Protocol to use: HTTP or HTTPS ?
        var protocolHandler = null;
        switch (certUrl.protocol) {
        case 'http:':
          protocolHandler = http;
          break;
        case 'https:':
          protocolHandler = https;
          break;
        default:
          protocolHandler = null;
        }
        if (!protocolHandler) {
          log.debug('WS::onWSMessage::registerWA --> Non valid URL (invalid protocol)');
          return connection.res({
            errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
            extradata: {
              'watoken': watoken,
              messageType: 'registerWA'
            }
          });
        }
        var req = protocolHandler.get(certUrl.href, function(res) {
            res.on('data', function(d) {
              req.abort();
              log.debug('Certificate received');
              crypto.parseClientCertificate(d,function(err,cert) {
                log.debug('Certificate processed');
                if(err) {
                  log.debug('[ERROR] ' + err);
                  return connection.res({
                    errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
                    extradata: {
                      'watoken': watoken,
                      messageType: 'registerWA'
                    }
                  });
                }
                log.debug('[VALID CERTIFICATE] ' + cert.c);
                log.debug('[VALID CERTIFICATE FINGERPRINT] ' + cert.f);

                // Valid certificate, register and store in database
                log.debug('WS::onWSMessage::registerWA uaid: ' + connection.uaid);
                  appToken = helpers.getAppToken(watoken, cert.f);
                  dataManager.registerApplication(appToken, watoken, connection.uaid, cert, function(error) {
                    if (!error) {
                      var notifyURL = helpers.getNotificationURL(appToken);
                      connection.res({
                        errorcode: errorcodes.NO_ERROR,
                        extradata: {
                          'watoken': watoken,
                          messageType: 'registerWA',
                          status: 'REGISTERED',
                          url: notifyURL
                        }
                      });
                      log.debug('WS::onWSMessage::registerWA --> OK registering WA');
                    } else {
                      connection.res({
                        errorcode: errorcodes.NOT_READY,
                        extradata: {
                          'watoken': watoken,
                          messageType: 'registerWA'
                        }
                      });
                      log.debug('WS::onWSMessage::registerWA --> Failing registering WA');
                    }
                  });
              });
            });
        }).on('error', function(e) {
          log.debug('Error downloading client certificate ', e);
          return connection.res({
            errorcode: errorcodesWS.NOT_VALID_CERTIFICATE_URL,
            extradata: {
              'watoken': watoken,
              messageType: 'registerWA'
            }
          });
        });
        break;

        /**
          {
            messageType: "unregister",
            channelId: <channelId>
          }
         */
      case 'unregister':
        log.debug('WS::onWSMessage::unregister --> Application un-registration message');

        // Close the connection if the channelID is null
        var channelID = query.channelID;
        if (!channelID) {
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

        appToken = helpers.getAppToken(query.channelID, connection.uaid);
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
        // TODO: ----
        if (query.messageId) {
          dataManager.removeMessage(query.messageId, connection.uaid);
        }
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
