function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

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
import { Subject, BehaviorSubject, interval, timer } from 'rxjs';
import { takeUntil, filter, startWith, first, distinctUntilChanged } from 'rxjs/operators';
var POLLING_INTERVAL = 1500;

var Daemon = /*#__PURE__*/function () {
  function Daemon() {
    var _this = this;

    var boardsUrl = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'https://builder.arduino.cc/v3/boards';

    _classCallCheck(this, Daemon);

    this.BOARDS_URL = boardsUrl;
    this.UPLOAD_NOPE = 'UPLOAD_NOPE';
    this.UPLOAD_DONE = 'UPLOAD_DONE';
    this.UPLOAD_ERROR = 'UPLOAD_ERROR';
    this.UPLOAD_IN_PROGRESS = 'UPLOAD_IN_PROGRESS';
    this.DOWNLOAD_DONE = 'DOWNLOAD_DONE';
    this.DOWNLOAD_NOPE = 'DOWNLOAD_NOPE';
    this.DOWNLOAD_ERROR = 'DOWNLOAD_ERROR';
    this.DOWNLOAD_IN_PROGRESS = 'DOWNLOAD_IN_PROGRESS';
    this.agentInfo = {};
    this.agentFound = new BehaviorSubject(null);
    this.channelOpen = new BehaviorSubject(null);
    this.channelOpenStatus = this.channelOpen.pipe(distinctUntilChanged());
    this.error = new BehaviorSubject(null).pipe(distinctUntilChanged());
    this.serialMonitorError = new BehaviorSubject(null);
    this.appMessages = new Subject();
    this.serialMonitorOpened = new BehaviorSubject(false);
    this.serialMonitorMessages = new Subject();
    this.serialMonitorMessagesWithPort = new Subject();
    this.uploading = new BehaviorSubject({
      status: this.UPLOAD_NOPE
    });
    this.uploadInProgress = this.uploading.pipe(filter(function (upload) {
      return upload.status === _this.UPLOAD_IN_PROGRESS;
    }));
    this.uploadingDone = this.uploading.pipe(filter(function (upload) {
      return upload.status === _this.UPLOAD_DONE;
    })).pipe(first()).pipe(takeUntil(this.uploading.pipe(filter(function (upload) {
      return upload.status === _this.UPLOAD_ERROR;
    }))));
    this.uploadingError = this.uploading.pipe(filter(function (upload) {
      return upload.status === _this.UPLOAD_ERROR;
    })).pipe(first()).pipe(takeUntil(this.uploadingDone));
    this.devicesList = new BehaviorSubject({
      serial: [],
      network: []
    });
    this.supportedBoards = new BehaviorSubject([]);
    this.appMessages.subscribe(function (message) {
      return _this.handleAppMessage(message);
    }); // Close all serial ports on startup

    this.devicesList.pipe(filter(function (devices) {
      return devices.serial && devices.serial.length > 0;
    })).pipe(first()).subscribe(function () {
      return _this.closeAllPorts();
    });
    this.downloading = new BehaviorSubject({
      status: this.DOWNLOAD_NOPE
    });
    this.downloadingDone = this.downloading.pipe(filter(function (download) {
      return download.status === _this.DOWNLOAD_DONE;
    })).pipe(first()).pipe(takeUntil(this.downloading.pipe(filter(function (download) {
      return download.status === _this.DOWNLOAD_ERROR;
    }))));
    this.downloadingError = this.downloading.pipe(filter(function (download) {
      return download.status === _this.DOWNLOAD_ERROR;
    })).pipe(first()).pipe(takeUntil(this.downloadingDone));
    this.boardPortAfterUpload = new Subject().pipe(first());
    this.uploadingPort = null;
  }

  _createClass(Daemon, [{
    key: "notifyUploadError",
    value: function notifyUploadError(err) {
      this.uploading.next({
        status: this.UPLOAD_ERROR,
        err: err
      });
    }
  }, {
    key: "openChannel",
    value: function openChannel(cb) {
      var _this2 = this;

      this.channelOpen.subscribe(function (open) {
        if (open) {
          interval(POLLING_INTERVAL).pipe(startWith(0)).pipe(takeUntil(_this2.channelOpen.pipe(filter(function (status) {
            return !status;
          })))).subscribe(cb);
        } else {
          _this2.devicesList.next({
            serial: [],
            network: []
          });

          _this2.agentFound.next(false);
        }
      });
    }
    /**
     * Upload a sketch to serial target
     * Fetch commandline from boards API for serial upload
     * @param {Object} target
     * @param {string} sketchName
     * @param {Object} compilationResult
     * @param {boolean} verbose
     */

  }, {
    key: "uploadSerial",
    value: function uploadSerial(target, sketchName, compilationResult) {
      var _this3 = this;

      var verbose = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
      this.uploadingPort = target.port;
      this.uploading.next({
        status: this.UPLOAD_IN_PROGRESS,
        msg: 'Upload started'
      });
      this.serialDevicesBeforeUpload = this.devicesList.getValue().serial;
      this.closeSerialMonitor(target.port); // Fetch command line for the board

      fetch("".concat(this.BOARDS_URL, "/").concat(target.board, "/compute"), {
        method: 'POST',
        body: JSON.stringify({
          action: 'upload',
          verbose: verbose,
          os: this.agentInfo.os
        })
      }).then(function (result) {
        return result.json();
      }).then(function (uploadCommandInfo) {
        var projectNameIndex = uploadCommandInfo.commandline.indexOf('{build.project_name}');
        var ext = uploadCommandInfo.commandline.substring(projectNameIndex + 21, projectNameIndex + 24);
        var data = compilationResult[ext] || compilationResult.bin;

        if (!ext || !data) {
          console.log('we received a faulty ext property, defaulting to .bin');
          ext = 'bin';
        }

        var uploadPayload = _objectSpread(_objectSpread({}, target), {}, {
          commandline: uploadCommandInfo.commandline,
          filename: "".concat(sketchName, ".").concat(ext),
          hex: data,
          // For desktop agent
          data: data // For chromeOS plugin, consider to align this

        });

        _this3.uploadingDone.subscribe(function () {
          _this3.waitingForPortToComeUp = timer(1000).subscribe(function () {
            var currentSerialDevices = _this3.devicesList.getValue().serial;

            var boardFound = currentSerialDevices.find(function (device) {
              return device.Name === _this3.uploadingPort;
            });

            if (!boardFound) {
              boardFound = currentSerialDevices.find(function (d) {
                return _this3.serialDevicesBeforeUpload.every(function (e) {
                  return e.Name !== d.Name;
                });
              });

              if (boardFound) {
                _this3.uploadingPort = boardFound.Name;

                _this3.boardPortAfterUpload.next({
                  hasChanged: true,
                  newPort: _this3.uploadingPort
                });
              }
            }

            if (boardFound) {
              _this3.waitingForPortToComeUp.unsubscribe();

              _this3.uploadingPort = null;
              _this3.serialDevicesBeforeUpload = null;

              _this3.boardPortAfterUpload.next({
                hasChanged: false
              });
            }
          });
        });

        var files = [].concat(_toConsumableArray(uploadCommandInfo.files || []), _toConsumableArray(compilationResult.files || []));

        _this3._upload(uploadPayload, _objectSpread(_objectSpread({}, uploadCommandInfo), {}, {
          files: files
        }));
      });
    }
    /**
     * Compares 2 devices list checking they contains the same ports in the same order
     * @param {Array<device>} a the first list
     * @param {Array<device>} b the second list
     */

  }, {
    key: "stopUpload",
    value:
    /**
     * Interrupt upload - not supported in Chrome app
     */
    function stopUpload() {
      if (typeof this.stopUploadCommand === 'function') {
        this.stopUploadCommand();
      } else {
        throw new Error('Stop Upload not supported on Chrome OS');
      }
    }
    /**
     * Set the board in bootloader mode. This is needed to bo 100% sure to receive the correct vid/pid from the board.
     * To do that we just touch the port at 1200 bps and then close it. The sketch on the board will be erased.
     * @param {String} port the port name
     */

  }, {
    key: "setBootloaderMode",
    value: function setBootloaderMode(port) {
      var _this4 = this;

      this.serialMonitorOpened.pipe(filter(function (open) {
        return open;
      })).pipe(first()).subscribe(function () {
        timer(1000).subscribe(function () {
          return _this4.closeSerialMonitor(port);
        });
      });
      this.openSerialMonitor(port, 1200);
    }
  }], [{
    key: "devicesListAreEquals",
    value: function devicesListAreEquals(a, b) {
      if (!a || !b || a.length !== b.length) {
        return false;
      }

      return a.every(function (item, index) {
        return b[index].Name === item.Name && b[index].IsOpen === item.IsOpen;
      });
    }
  }]);

  return Daemon;
}();

export { Daemon as default };