"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "FirmwareUpdater", {
  enumerable: true,
  get: function get() {
    return _firmwareUpdater["default"];
  }
});
exports["default"] = void 0;

var _socketDaemon = _interopRequireDefault(require("./socket-daemon"));

var _chromeOsDaemon = _interopRequireDefault(require("./chrome-os-daemon"));

var _firmwareUpdater = _interopRequireDefault(require("./firmware-updater"));

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
var Daemon = window.navigator.userAgent.indexOf(' CrOS ') !== -1 ? _chromeOsDaemon["default"] : _socketDaemon["default"];
var _default = Daemon;
exports["default"] = _default;