"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = ChromeOsDaemon;

var _webSerialDaemon = _interopRequireDefault(require("./web-serial-daemon"));

var _chromeAppDaemon = _interopRequireDefault(require("./chrome-app-daemon"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/*
* Copyright 2018 ARDUINO SA (http://www.arduino.cc/)
* This file is part of arduino-create-agent-js-client.
* Copyright (c) 2018
* Authors: Alberto Iannaccone, Stefania Mellai, Gabriele Destefanis
*
* This software is released under:
* The GNU General Public License, which covers the main part of
* arduino-create-agent-js-client
* The terms of this license can be found at:
* https://www.gnu.org/licenses/gpl-3.0.en.html
*
* You can be released from the requirements of the above licenses by purchasing
* a commercial license. Buying such a license is mandatory if you want to modify or
* otherwise use the software for commercial activities involving the Arduino
* software without disclosing the source code of your own applications. To purchase
* a commercial license, send an email to license@arduino.cc.
*
*/

/**
 * ChromeOSDaemon is a new implementation for ChromeOS which allows
 + to select the legacy Chrome app or the new BETA web serial API,
 * based on the the existance of a `useWebSerial` key available in the constructor.
 * Warning: support for WebSerialDaemon is still in alpha, so if you don't know
 * how to deal with Web Serial API, just stick with the Chrome App Deamon.
 *
 */
function ChromeOsDaemon(boardsUrl, options) {
  var _this = this;

  var useWebSerial;
  var chromeExtensionId;
  var uploader; // check chromeExtensionId OR web serial API

  if (typeof options === 'string') {
    chromeExtensionId = options;
  } else {
    chromeExtensionId = options.chromeExtensionId;
    useWebSerial = options.useWebSerial;
    uploader = options.uploader;
  }

  if ('serial' in navigator && useWebSerial && Boolean(uploader)) {
    console.debug('Instantiating WebSerialDaemon');
    this.flavour = new _webSerialDaemon["default"](boardsUrl, uploader);
  } else {
    console.debug('Instantiating ChromeAppDaemon');
    this.flavour = new _chromeAppDaemon["default"](boardsUrl, chromeExtensionId);
  }

  var handler = {
    get: function get(_, name) {
      return _this.flavour[name];
    },
    set: function set(_, name, value) {
      _this.flavour[name] = value;
      return true;
    }
  };
  return new Proxy(this, handler);
}