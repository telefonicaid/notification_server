/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var dataStore = require('../../common/datastore'),
    log = require('../../common/logger.js'),
    events = require('events')
    uuid = require('node-uuid'),
    url = require('url');

var kMozUAFrontendVERSION = 'v1';

var MozUAFrontendv1 = function() {
  this.processMozRequest = function(request, response) {
    var URI = request.url.split('/');
    if (URI.length < 3) {
      response.statusCode = 400;
      response.end('{ reason: "Not enough path data"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> Not enough path');
      return;
    }

    if (URI[1] !== kMozUAFrontendVERSION) {
      response.statusCode = 400;
      response.end('{ reason: "Protocol version not supported"}');
      log.debug('NS_UA_Moz_v1::processMozRequest --> Version not supported, received: ' + URI[1]);
      return;
    }

    switch(request.method) {
      case 'PUT':
	//https://wiki.mozilla.org/WebAPI/SimplePush/ServerAPI#GET_.2Fv1.2Fregister.2F.3CchannelID.3E
	if (URI[2] === 'register') {
	  log.debug('NS_UA_Moz_v1::processMozRequest --> PUT-register method');
	  request.on('data', function(chunk) {
	    this.handlePutRegister(request, chunk, response);
	  }.bind(this));
	  return;
	}
	response.statusCode = 400;
	response.end('{ reason: "PUT method not recognized"}');
	log.debug('NS_UA_Moz_v1::processMozRequest --> PUT method not recognized, received ' + URI[2]);
	return;
	break;

      case 'GET':
        //https://wiki.mozilla.org/WebAPI/SimplePush/ServerAPI#GET_.2Fv1.2Fupdate.2F
        if (URI[2] === 'update') {
          log.debug('NS_UA_Moz_v1::processMozRequest --> GET-update method');
          this.handleGetUpdate(request, response);
          return;
        }

        response.statusCode = 400;
        response.end('{ reason: "GET method not recognized"}');
        log.debug('NS_UA_Moz_v1::processMozRequest --> GET method not recognized, received ' + URI[2]);
        return;
        break;

      case 'POST':
        //https://wiki.mozilla.org/WebAPI/SimplePush/ServerAPI#Server_recovery_mode
        log.debug('NS_UA_Moz_v1::processMozRequest --> POST method');
        var self = this;
	response.on('data', function (chunk) {
	  self.handlePost(request, chunk, response);
        });
        break;

      case 'DELETE':
        //https://wiki.mozilla.org/WebAPI/SimplePush/ServerAPI#DELETE_.2Fv1.2F.3CChannelID.3E
        log.debug('NS_UA_Moz_v1::processMozRequest --> DELETE method');
        this.handleDelete(request, response);
        break;

      default:
        log.debug('NS_UA_Moz_v1::processMozRequest --> HTTP method not recognized, received ' + request.method);
        response.statusCode = 400;
        response.end('{ reason: "HTTP method not allowed"}');
        break;
    }
  },

  this.handleGetUpdate = function(request, response) {
    var xUserAgentId = request.headers['x-useragent-id'];
    if (!xUserAgentId) {
      response.statusCode = 403;
      response.end('{ reason: "X-UserAgent-ID not provided."}');
      return;
    }

    dataStore.getNodeData(xUserAgentId, function(error, data) {
      if (error) {
        if (error.status === 410) {
          response.statusCode = 410;
          response.end('{ reason: "Server in recovery mode. Please start Registration Sync Protocol"}');
          return;
        }
        response.statusCode = 500;
        response.end('{ reason: "Internal Server Error"}');
        return;
      }

      //Empty data, which means nothing is found on the DB, even the UserAgent-ID
      if (!data) {
        response.statusCode = 403;
        response.end('{ reason: "Wrong X-UserAgent-ID"}');
        return;
      }

      var rv = {};
      rv.updates = data.updates;
      response.statusCode = 200;
      response.end(JSON.stringify(rv));
    });
  },

  this.handlePutRegister = function(request, chunk, response) {
    try {
      var data = JSON.parse(chunk);
    } catch(e) {
      response.statusCode = 400;
      response.end('{ reason: "Bad JSON"}');
      return;
    }

    //Checking X-UserAgent-[DATA] to register.
    var xUserAgentId = request.headers['x-useragent-id'] || uuid.v4();
    var xUserAgentIp = request.headers['x-useragent-ip'] || null;
    var xUserAgentPort = request.headers['x-useragent-port'] || null;
    var xUserAgentMCC = request.headers['x-useragent-mcc'] || null;
    var xUserAgentMNC = request.headers['x-useragent-mnc'] || null;
    */

    //Checking X-WebApp-Cert to register
    var xWebAppCertUrl = request.headers['x-webapp-cert-url'] || "null"; //TODO. Fix test string to null (no quotes!!)
    if (!xWebAppCertUrl) {
      response.statusCode = 403;
      response.end('{ reason: "Certificate URL not provided. Not allowed."}');
      return;
    }

    var channelID = request.url.split('/')[3];
    if (!channelID) {
      response.statusCode = 404;
      response.end('{ reason: "ChannelID not provided. Please generate one."}');
      return;
    }

    //We have all the data required now.
    //TODO. Check what to save into the DDBB
    var data = {
      interface: null,
      mobilenetwork: null,
      protocol: null
    };

    //Save to DDBB
    dataStore.registerNode(xUserAgentId, null, data, function(error) {
      if (error) {
        if (error.status === 410) {
          response.statusCode = 410;
          response.end('{ reason: "Server in recovery mode. Please start Registration Sync Protocol"}');
          return;
        }
        response.statusCode = 500;
        response.end('{ reason: "Internal Server Error"}');
        return;
      }
      dataStore.registerApplication(channelID, channelID, xUserAgentId, xWebAppCertUrl, function(error){
        if (error){
          if (error.status === 409) {
            response.statusCode = 409;
            response.end('{ reason: "Duplicate channelID. Please, generate a new ID and try again"}');
            return;
          }
          response.statusCode = 500;
          response.end('{ reason: "Internal Server Error"}');
          return;
        }
        var res = {
          channelID: channelID,
          //TODO: Fix to use helpers library
          pushEndPoint: 'https://push.telefonica.com/v1/update/' + channelID,
          uaid: xUserAgentId
        };
        response.statusCode = 200;
        response.end(JSON.stringify(res));
      });
    });
  },

  this.handleDelete = function(request, response) {
    var xUserAgentId = request.headers['x-useragent-id'];
    if (!xUserAgentId) {
      response.statusCode = 403;
      response.end('{ reason: "X-UserAgent-ID not provided."}');
      return;
    }

    var channelID = request.url.split('/')[2];
    if (!channelID) {
      response.statusCode = 404;
      response.end('{ reason: "ChannelID not provided. Please generate one."}');
      return;
    }
    dataStore.unregisterApplication(channelID, xUserAgentId, null, function(error) {
      if (error) {
        if (error.status === 410) {
          response.statusCode = 410;
          response.end('{ reason: "Server in recovery mode. Please start Registration Sync Protocol"}');
          return;
        }
        if (error.status === 404) {
          response.statusCode = 404;
          response.end('{ reason: "ChannelID previously deleted"}');
          return;
        }
        response.statusCode = 500;
        response.end('{ reason: "Internal Server Error"}');
        return;
      }
      response.statusCode = 200;
      response.end('{}');
      return;
    });
  },

  this.handlePost = function(request, body, response) {
    //Check if the POSTed data are a valid JSON.
    try {
      JSON.parse(body);
    } catch (e) {
      response.statusCode = 400;
      response.end('{ reason: "Bad JSON" }');
    }

    var xUserAgentId = request.headers['x-useragent-id'];
    if (!xUserAgentId) {
      response.statusCode = 403;
      response.end('{ reason: "X-UserAgent-ID not provided."}');
      return;
    }

    //TODO: get from somewhere
    var isServerOnRecoveryMode = true;
    if (!isServerOnRecoveryMode) {
      response.statusCode = 403;
      response.end('{ reason: "Server is not on Recovery Mode."}');
      return;
    }

    dataStore.getNodeData(xUserAgentId, function(error, data) {
      if (error) {
        response.statusCode = 500;
        response.end('{ reason: "Internal Server Error"}');
        return;
            }
            if (data) {
        response.statusCode = 403;
        response.end('{ reason: "Server has data for X-UserAgent-ID. Rejecting."}');
        return;
      }
      //TODO. Function not available!!
      dataStore.mozUpdateData(xUserAgentId, postData, function(error) {
        if (error) {
          response.statusCode = 500;
          response.end('{ reason: "Internal Server Error"}');
          return;
        }
        response.statusCode = 200;
        response.end('{}');
      });
    });
  };
};

module.exports = MozUAFrontendv1;