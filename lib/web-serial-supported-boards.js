"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

/* We're moving away from the Chrome App on Chromebooks due to the deprecation of Chrome apps in Chrome.
 * See: https://blog.chromium.org/2020/08/changes-to-chrome-app-support-timeline.html
 *
 * We're adding support to new boards progressively, hence boards listed in this file will be using
 * the Web Serial API instead of the Chrome App on ChromeOS systems.
 *
 * Info about the boards are gathered from different files available in specific Arduino GitHub repos.
 *
 * E.g. for SAMD boards:
 * https://github.com/arduino/ArduinoCore-samd/blob/master/boards.txt
 */
var boards = {
  'arduino:samd:mkrwifi1010': {
    name: 'Arduino MKR WiFi 1010',
    'vid.0': '0x2341',
    'pid.0': '0x8054',
    'vid.1': '0x2341',
    'pid.1': '0x0054'
  }
};
var _default = boards;
exports["default"] = _default;