/**
 * Twitter streamer sample for PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 */

var config = require('./config.js'),
    crypto = require('crypto'),
    t = require('twit');

function twitter_server() {
  this.msgLastId = 1;
}

twitter_server.prototype = {
  ///////////////////////////////////////////////////////////////////////////////
  // Cryptography
  ///////////////////////////////////////////////////////////////////////////////
  signMessage: function signMessage(data,privateKey) {
    var algorithm = 'RSA-SHA256';
    var signer = crypto.createSign(algorithm);
    signer.update(data);
    return signer.sign(privateKey, 'hex');
  },

  ///////////////////////////////////////////////////////////////////////////////
  // Twitter client
  ///////////////////////////////////////////////////////////////////////////////
  init: function init() {
    console.log("Connecting with Twitter");
    this.T = new t({
      consumer_key: config.twitter.consumer_key,
      consumer_secret: config.twitter.consumer_secret,
      access_token: config.twitter.access_token,
      access_token_secret: config.twitter.access_token_secret
    });

    var stream = null;
    for(var i in config.twitter.streamsToFollow) {
      console.log("Registering to stream " + config.twitter.streamsToFollow[i]);
      stream = this.T.stream('statuses/filter', {
        track: config.twitter.streamsToFollow[i]
      });
      stream.on('tweet', this.reSendTweet.bind(this));
    }
    for(var i in config.twitter.localizedStreams) {
      console.log("Registering to localized stream " +
        config.twitter.localizedStreams[i][1]);
      stream = this.T.stream('statuses/filter', {
        locations: config.twitter.localizedStreams[i][0]
      });
      stream.on('tweet', this.reSendTweet.bind(this));
    }
  },

  reSendTweet: function(tweet) {
    var msg = tweet.text

    console.log("New tweet !");
    var notif = JSON.stringify({
      messageType: 'notification',
      id: this.msgLastId++,
      message: msg,
      signature: this.signMessage(msg, config.crypto.privateKey),
      ttl: 1,
      timestamp: "'" + Date.now() + "'",
      priority: 2
    });

    var options = {
      host: config.pushserver.host,
      port: config.pushserver.port,
      path: config.pushserver.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    };

    var http = null;
    if(config.pushserver.ssl) {
      http = require('https');
    } else {
      http = require('http');
    }

    var req = http.request(options, function(res) {
      console.log('Message status: ' + res.statusCode);
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    req.write(notif);
    req.end();

    console.log(notif.length + " - " + JSON.stringify(notif));
  }
};

/////////////////////////////////////////////////////////////////////////////

console.log("Starting twitter streamer sample");
var ts = new twitter_server();
ts.init();
