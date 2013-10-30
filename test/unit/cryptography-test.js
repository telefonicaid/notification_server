/**
 * PUSH Notification server
 * (c) Telefonica Digital, 2012 - All rights reserved
 * License: GNU Affero V3 (see LICENSE file)
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var cr = require("../../src/common/Cryptography.js"),
    assert = require('assert'),
    vows = require('vows');

vows.describe('Cryptography tests').addBatch({
  "SHA256": function() {
    var sha = cr.hashSHA256('hello');
    assert.isString(sha);
    assert.equal(sha,
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    sha = cr.hashSHA256('Lorem ipsum dolor sit amet, consectetur adipiscing ' +
      'elit. Donec ac lectus ullamcorper, placerat justo ac, sollicitudin ' +
      'augue. Vestibulum vulputate purus vitae orci faucibus dignissim. ' +
      'Maecenas rutrum turpis leo, nec pellentesque arcu blandit eget. Sed ' +
      'bibendum sit amet neque a dignissim. Ut quis nulla eleifend, luctus ' +
      'lectus id, cursus tellus. Nullam interdum erat a pretium elementum. ' +
      'Praesent fermentum porta leo vitae gravida. Praesent cursus lacus ' +
      'condimentum metus feugiat, a pulvinar ante consectetur. Phasellus ' +
      'sed sapien egestas, lacinia sem id, eleifend urna. Quisque id ' +
      'convallis urna. Duis vitae scelerisque dolor.');
    assert.equal(sha,
      '7b2d8450de89e2ef0c7b85c8d1dd1e499008a142cef20ac76c098782cf2920d6');
  },
  "SHA512": function() {
    var sha = cr.hashSHA512('hello');
    assert.isString(sha);
    assert.equal(sha,
      '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c' +
      '3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043');
    sha = cr.hashSHA512('Lorem ipsum dolor sit amet, consectetur adipiscing ' +
      'elit. Donec ac lectus ullamcorper, placerat justo ac, sollicitudin ' +
      'augue. Vestibulum vulputate purus vitae orci faucibus dignissim. ' +
      'Maecenas rutrum turpis leo, nec pellentesque arcu blandit eget. Sed ' +
      'bibendum sit amet neque a dignissim. Ut quis nulla eleifend, luctus ' +
      'lectus id, cursus tellus. Nullam interdum erat a pretium elementum. ' +
      'Praesent fermentum porta leo vitae gravida. Praesent cursus lacus ' +
      'condimentum metus feugiat, a pulvinar ante consectetur. Phasellus ' +
      'sed sapien egestas, lacinia sem id, eleifend urna. Quisque id ' +
      'convallis urna. Duis vitae scelerisque dolor.');
    assert.equal(sha,
      '3f82ebfbb729a9535afeb0adb61d6037c325eb6be7ed3581d0722659faff692da9d10' +
      '53e677ea478fe453ad6f24df3b6ddeafb261d5502a2b7dbdc23d7fb1082');
  },
  "generateHMAC": function() {
    var sha = cr.generateHMAC('hello','12345678901234567890');
    assert.isString(sha);
    assert.equal(sha,
      '3f4d5f49782448009fc54047201e0a9fbd755c13');
    sha = cr.generateHMAC('Lorem ipsum dolor sit amet, consectetur adipiscing ' +
      'elit. Donec ac lectus ullamcorper, placerat justo ac, sollicitudin ' +
      'augue. Vestibulum vulputate purus vitae orci faucibus dignissim. ' +
      'Maecenas rutrum turpis leo, nec pellentesque arcu blandit eget. Sed ' +
      'bibendum sit amet neque a dignissim. Ut quis nulla eleifend, luctus ' +
      'lectus id, cursus tellus. Nullam interdum erat a pretium elementum. ' +
      'Praesent fermentum porta leo vitae gravida. Praesent cursus lacus ' +
      'condimentum metus feugiat, a pulvinar ante consectetur. Phasellus ' +
      'sed sapien egestas, lacinia sem id, eleifend urna. Quisque id ' +
      'convallis urna. Duis vitae scelerisque dolor.', '09876543210987654321');
    assert.equal(sha,
      'df145a48d116d3a8d3411b740966de7f4f98241c');
  }
}).export(module);
