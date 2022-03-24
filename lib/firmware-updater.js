"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _rxjs = require("rxjs");

var _semverCompare = _interopRequireDefault(require("semver-compare"));

var _operators = require("rxjs/operators");

var _signatures = require("./signatures");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

/* The status of the Firmware Updater Tool */
var FWUToolStatusEnum = Object.freeze({
  NOPE: 'NOPE',
  OK: 'OK',
  CHECKING: 'CHECKING',
  ERROR: 'ERROR DOWNLOADING TOOL'
});
/* The signatures needed to run the commands to use the Firmware Updater Tool */

var signatures = _signatures.fwupdaterSignatures;
var updaterBinaryName = 'FirmwareUploader';

function programmerFor(boardId) {
  if (boardId === 'uno2018') return ['{runtime.tools.avrdude}/bin/avrdude', signatures.UPLOAD_FIRMWARE_AVRDUDE];
  if (boardId === 'nanorp2040connect') return ["{runtime.tools.rp2040tools.path}/rp2040load", signatures.UPLOAD_FIRMWARE_RP2040];
  return ["{runtime.tools.bossac}/bossac", signatures.UPLOAD_FIRMWARE_BOSSAC];
}

var FirmwareUpdater = /*#__PURE__*/function () {
  function FirmwareUpdater(Daemon) {
    var _this = this;

    _classCallCheck(this, FirmwareUpdater);

    this.updateStatusEnum = Object.freeze({
      NOPE: 'NOPE',
      STARTED: 'STARTED',
      GETTING_INFO: 'GETTING_INFO',
      GOT_INFO: 'GOT_INFO',
      UPLOADING: 'UPLOADING',
      DONE: 'DONE',
      ERROR: 'ERROR'
    });
    this.Daemon = Daemon;
    this.FWUToolStatus = FWUToolStatusEnum.NOPE;
    this.Daemon.downloadingDone.subscribe(function () {
      _this.FWUToolStatus = FWUToolStatusEnum.OK;
    });
    this.updating = new _rxjs.BehaviorSubject({
      status: this.updateStatusEnum.NOPE
    });
    this.updatingDone = this.updating.pipe((0, _operators.filter)(function (update) {
      return update.status === _this.updateStatusEnum.DONE;
    })).pipe((0, _operators.first)()).pipe((0, _operators.takeUntil)(this.updating.pipe((0, _operators.filter)(function (update) {
      return update.status === _this.updateStatusEnum.ERROR;
    }))));
    this.updatingError = this.updating.pipe((0, _operators.filter)(function (update) {
      return update.status === _this.updateStatusEnum.ERROR;
    })).pipe((0, _operators.first)()).pipe((0, _operators.takeUntil)(this.updatingDone));
    this.gotFWInfo = this.updating.pipe((0, _operators.filter)(function (update) {
      return update.status === _this.updateStatusEnum.GOT_INFO;
    })).pipe((0, _operators.first)()).pipe((0, _operators.takeUntil)(this.updatingDone)).pipe((0, _operators.takeUntil)(this.updatingError));
  }

  _createClass(FirmwareUpdater, [{
    key: "setToolVersion",
    value: function setToolVersion(version) {
      this.toolVersion = version;

      if ((0, _semverCompare["default"])(version, '0.1.2') < 0) {
        signatures = _signatures.oldFwupdaterSignatures;
        updaterBinaryName = 'updater';
      }
    }
  }, {
    key: "getFirmwareInfo",
    value: function getFirmwareInfo(boardId, port, firmwareVersion) {
      var _this2 = this;

      this.firmwareVersionData = null;
      this.loaderPath = null;
      this.updating.next({
        status: this.updateStatusEnum.GETTING_INFO
      });
      var versionsList = [];
      var firmwareInfoMessagesSubscription;

      var handleFirmwareInfoMessage = function handleFirmwareInfoMessage(message) {
        var versions;

        switch (message.ProgrammerStatus) {
          case 'Starting':
            break;

          case 'Busy':
            if (message.Msg.indexOf('Flashing with command:') >= 0) {
              return;
            }

            versions = JSON.parse(message.Msg);
            Object.keys(versions).forEach(function (v) {
              if (versions[v][0].IsLoader) {
                _this2.loaderPath = versions[v][0].Path;
              } else {
                versionsList = [].concat(_toConsumableArray(versionsList), _toConsumableArray(versions[v]));
              }
            });
            _this2.firmwareVersionData = versionsList.find(function (version) {
              return version.Name.split(' ').splice(-1)[0].trim() === firmwareVersion;
            });

            if (!_this2.firmwareVersionData) {
              _this2.updating.next({
                status: _this2.updateStatusEnum.ERROR,
                err: "Can't get firmware info: couldn't find version '".concat(firmwareVersion, "' for board '").concat(boardId, "'")
              });
            } else {
              firmwareInfoMessagesSubscription.unsubscribe();

              _this2.updating.next({
                status: _this2.updateStatusEnum.GOT_INFO
              });
            }

            break;

          case 'Error':
            _this2.updating.next({
              status: _this2.updateStatusEnum.ERROR,
              err: "Couldn't get firmware info: ".concat(message.Msg)
            });

            firmwareInfoMessagesSubscription.unsubscribe();
            break;

          default:
            break;
        }
      };

      if (this.FWUToolStatus !== FWUToolStatusEnum.OK) {
        this.updating.next({
          status: this.updateStatusEnum.ERROR,
          err: "Can't get firmware info: couldn't find firmware updater tool"
        });
        return;
      }

      firmwareInfoMessagesSubscription = this.Daemon.appMessages.subscribe(function (message) {
        if (message.ProgrammerStatus) {
          handleFirmwareInfoMessage(message);
        }
      });
      var data = {
        board: boardId,
        port: port,
        commandline: "\"{runtime.tools.fwupdater.path}/".concat(updaterBinaryName, "\" -get_available_for {network.password}"),
        signature: signatures.GET_FIRMWARE_INFO,
        extra: {
          auth: {
            password: boardId
          }
        },
        filename: 'ListFirmwareVersionsInfo.bin'
      };
      return fetch("".concat(this.Daemon.pluginURL, "/upload"), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        },
        body: JSON.stringify(data)
      }).then(function (response) {
        if (!response.ok) {
          _this2.updating.next({
            status: _this2.updateStatusEnum.ERROR,
            err: "Error fetching ".concat(_this2.Daemon.pluginURL, "/upload")
          });
        }
      })["catch"](function () {
        _this2.updating.next({
          status: _this2.updateStatusEnum.ERROR,
          err: "Coudln't list firmware versions info."
        });
      });
    }
  }, {
    key: "updateFirmware",
    value: function updateFirmware(boardId, port, firmwareVersion) {
      var _this3 = this;

      this.updating.next({
        status: this.updateStatusEnum.STARTED
      });
      this.Daemon.closeSerialMonitor(port);
      this.Daemon.serialMonitorOpened.pipe((0, _operators.filter)(function (open) {
        return !open;
      })).pipe((0, _operators.first)()).subscribe(function () {
        if (!port) {
          _this3.updating.next({
            status: _this3.updateStatusEnum.ERROR,
            err: "Can't update Firmware: no port selected."
          });

          return;
        }

        _this3.gotFWInfo.subscribe(function () {
          if (!_this3.firmwareVersionData) {
            _this3.updating.next({
              status: _this3.updateStatusEnum.ERROR,
              err: "Can't update Firmware: couldn't find version '".concat(firmwareVersion, "' for board '").concat(boardId, "'")
            });

            return;
          }

          var updateFirmwareMessagesSubscription;

          var handleFirmwareUpdateMessage = function handleFirmwareUpdateMessage(message) {
            switch (message.ProgrammerStatus) {
              case 'Busy':
                if (message.Msg.indexOf('Operation completed: success! :-)') >= 0) {
                  _this3.updating.next({
                    status: _this3.updateStatusEnum.DONE
                  });

                  updateFirmwareMessagesSubscription.unsubscribe();
                }

                break;

              case 'Error':
                _this3.updating.next({
                  status: _this3.updateStatusEnum.ERROR,
                  err: "Can't update Firmware: ".concat(message.Msg)
                });

                updateFirmwareMessagesSubscription.unsubscribe();
                break;

              default:
                break;
            }
          };

          updateFirmwareMessagesSubscription = _this3.Daemon.appMessages.subscribe(function (message) {
            if (message.ProgrammerStatus) {
              handleFirmwareUpdateMessage(message);
            }
          });

          var _programmerFor = programmerFor(boardId),
              _programmerFor2 = _slicedToArray(_programmerFor, 2),
              programmer = _programmerFor2[0],
              signature = _programmerFor2[1];

          if (!_this3.loaderPath) {
            _this3.updating.next({
              status: _this3.updateStatusEnum.ERROR,
              err: "Can't update Firmware: 'loaderPath' is empty or 'null'"
            });

            return;
          }

          var data = {
            board: boardId,
            port: port,
            commandline: "\"{runtime.tools.fwupdater.path}/".concat(updaterBinaryName, "\" -flasher {network.password} -port {serial.port} -programmer \"").concat(programmer, "\""),
            hex: '',
            extra: {
              auth: {
                password: "\"".concat(_this3.loaderPath, "\" -firmware \"").concat(_this3.firmwareVersionData.Path, "\"")
              }
            },
            signature: signature,
            filename: 'CheckFirmwareVersion.bin'
          };
          fetch("".concat(_this3.Daemon.pluginURL, "/upload"), {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            },
            body: JSON.stringify(data)
          }).then(function (response) {
            if (!response.ok) {
              _this3.updating.next({
                status: _this3.updateStatusEnum.ERROR,
                err: "Can't update Firmware: error fetching ".concat(_this3.Daemon.pluginURL, "/upload")
              });
            }
          })["catch"](function (reason) {
            _this3.updating.next({
              status: _this3.updateStatusEnum.ERROR,
              err: "Can't update Firmware: ".concat(reason)
            });
          });
        });

        _this3.getFirmwareInfo(boardId, port, firmwareVersion);
      });
    }
  }]);

  return FirmwareUpdater;
}();

exports["default"] = FirmwareUpdater;