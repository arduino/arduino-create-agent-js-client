"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _daemon = _interopRequireDefault(require("./daemon"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var POLLING_INTERVAL = 2000;

var ChromeAppDaemon = /*#__PURE__*/function (_Daemon) {
  _inherits(ChromeAppDaemon, _Daemon);

  var _super = _createSuper(ChromeAppDaemon);

  function ChromeAppDaemon(boardsUrl, chromeExtensionId) {
    var _this;

    _classCallCheck(this, ChromeAppDaemon);

    _this = _super.call(this, boardsUrl);
    _this.chromeExtensionId = chromeExtensionId;
    _this.channel = null;

    _this.init();

    return _this;
  }

  _createClass(ChromeAppDaemon, [{
    key: "init",
    value: function init() {
      var _this2 = this;

      this.openChannel(function () {
        return _this2.channel.postMessage({
          command: 'listPorts'
        });
      });
      this.agentFound.pipe((0, _operators.distinctUntilChanged)()).subscribe(function (agentFound) {
        if (!agentFound) {
          _this2.findApp();
        }
      });
    }
  }, {
    key: "findApp",
    value: function findApp() {
      var _this3 = this;

      (0, _rxjs.interval)(POLLING_INTERVAL).pipe((0, _operators.startWith)(0)).pipe((0, _operators.takeUntil)(this.channelOpen.pipe((0, _operators.filter)(function (status) {
        return status;
      })))).subscribe(function () {
        return _this3._appConnect();
      });
    }
    /**
     * Instantiate connection and events listeners for chrome app
     */

  }, {
    key: "_appConnect",
    value: function _appConnect() {
      var _this4 = this;

      if (chrome.runtime) {
        this.channel = chrome.runtime.connect(this.chromeExtensionId);
        this.channel.onMessage.addListener(function (message) {
          if (message.version) {
            _this4.agentInfo = message;

            _this4.agentFound.next(true);

            _this4.channelOpen.next(true);
          } else {
            _this4.appMessages.next(message);
          }
        });
        this.channel.onDisconnect.addListener(function () {
          _this4.channelOpen.next(false);

          _this4.agentFound.next(false);
        });
      }
    }
  }, {
    key: "handleAppMessage",
    value: function handleAppMessage(message) {
      if (message.ports) {
        this.handleListMessage(message);
      }

      if (message.supportedBoards) {
        this.supportedBoards.next(message.supportedBoards);
      }

      if (message.serialData) {
        this.serialMonitorMessages.next(message.serialData);
      }

      if (message.uploadStatus) {
        this.handleUploadMessage(message);
      }

      if (message.err) {
        this.uploading.next({
          status: this.UPLOAD_ERROR,
          err: message.Err
        });
      }
    }
  }, {
    key: "handleListMessage",
    value: function handleListMessage(message) {
      var lastDevices = this.devicesList.getValue();

      if (!_daemon["default"].devicesListAreEquals(lastDevices.serial, message.ports)) {
        this.devicesList.next({
          serial: message.ports.map(function (port) {
            return {
              Name: port.name,
              SerialNumber: port.serialNumber,
              IsOpen: port.isOpen,
              VendorID: port.vendorId,
              ProductID: port.productId
            };
          }),
          network: []
        });
      }
    }
    /**
     * Send 'close' command to all the available serial ports
     */

  }, {
    key: "closeAllPorts",
    value: function closeAllPorts() {
      var _this5 = this;

      var devices = this.devicesList.getValue().serial;
      devices.forEach(function (device) {
        _this5.channel.postMessage({
          command: 'closePort',
          data: {
            name: device.Name
          }
        });
      });
    }
    /**
     * Send 'message' to serial port
     * @param {string} port the port name
     * @param {string} message the text to be sent to serial
     */

  }, {
    key: "writeSerial",
    value: function writeSerial(port, message) {
      this.channel.postMessage({
        command: 'writePort',
        data: {
          name: port,
          data: message
        }
      });
    }
    /**
     * Request serial port open
     * @param {string} port the port name
     */

  }, {
    key: "openSerialMonitor",
    value: function openSerialMonitor(port, baudrate) {
      var _this6 = this;

      if (this.serialMonitorOpened.getValue()) {
        return;
      }

      var serialPort = this.devicesList.getValue().serial.find(function (p) {
        return p.Name === port;
      });

      if (!serialPort) {
        return this.serialMonitorError.next("Can't find port ".concat(port));
      }

      this.appMessages.pipe((0, _operators.takeUntil)(this.serialMonitorOpened.pipe((0, _operators.filter)(function (open) {
        return open;
      })))).subscribe(function (message) {
        if (message.portOpenStatus === 'success') {
          _this6.serialMonitorOpened.next(true);
        }

        if (message.portOpenStatus === 'error') {
          _this6.serialMonitorError.next("Failed to open serial ".concat(port));
        }
      });
      this.channel.postMessage({
        command: 'openPort',
        data: {
          name: port,
          baudrate: baudrate
        }
      });
    }
    /**
     * Request serial port close
     * @param {string} port the port name
     */

  }, {
    key: "closeSerialMonitor",
    value: function closeSerialMonitor(port) {
      var _this7 = this;

      if (!this.serialMonitorOpened.getValue()) {
        return;
      }

      var serialPort = this.devicesList.getValue().serial.find(function (p) {
        return p.Name === port;
      });

      if (!serialPort) {
        return this.serialMonitorError.next("Can't find port ".concat(port));
      }

      this.appMessages.pipe((0, _operators.takeUntil)(this.serialMonitorOpened.pipe((0, _operators.filter)(function (open) {
        return !open;
      })))).subscribe(function (message) {
        if (message.portCloseStatus === 'success') {
          _this7.serialMonitorOpened.next(false);
        }

        if (message.portCloseStatus === 'error') {
          _this7.serialMonitorError.next("Failed to close serial ".concat(port));
        }
      });
      this.channel.postMessage({
        command: 'closePort',
        data: {
          name: port
        }
      });
    }
  }, {
    key: "handleUploadMessage",
    value: function handleUploadMessage(message) {
      if (this.uploading.getValue().status !== this.UPLOAD_IN_PROGRESS) {
        return;
      }

      switch (message.uploadStatus) {
        case 'message':
          this.uploading.next({
            status: this.UPLOAD_IN_PROGRESS,
            msg: message.message
          });
          break;

        case 'error':
          this.uploading.next({
            status: this.UPLOAD_ERROR,
            err: message.message
          });
          break;

        case 'success':
          this.uploading.next({
            status: this.UPLOAD_DONE,
            msg: message.message
          });
          break;

        default:
          this.uploading.next({
            status: this.UPLOAD_IN_PROGRESS
          });
      }
    }
    /**
     * Perform an upload via http on the daemon
     * @param {Object} target = {
     *   board: "name of the board",
     *   port: "port of the board",
     *   commandline: "commandline to execute",
     *   data: "compiled sketch"
     * }
     */

  }, {
    key: "_upload",
    value: function _upload(uploadPayload, uploadCommandInfo) {
      var _this8 = this;

      var board = uploadPayload.board,
          port = uploadPayload.port,
          commandline = uploadPayload.commandline,
          data = uploadPayload.data;
      var extrafiles = uploadCommandInfo && uploadCommandInfo.files && Array.isArray(uploadCommandInfo.files) ? uploadCommandInfo.files : [];

      try {
        window.oauth.token().then(function (token) {
          _this8.channel.postMessage({
            command: 'upload',
            data: {
              board: board,
              port: port,
              commandline: commandline,
              data: data,
              token: token.token,
              extrafiles: extrafiles
            }
          });
        });
      } catch (err) {
        this.uploading.next({
          status: this.UPLOAD_ERROR,
          err: 'you need to be logged in on a Create site to upload by Chrome App'
        });
      }
    }
  }, {
    key: "downloadTool",
    value: function downloadTool() {
      // no need to download tool on chromeOS
      this.downloading.next({
        status: this.DOWNLOAD_DONE
      });
    }
  }]);

  return ChromeAppDaemon;
}(_daemon["default"]);

exports["default"] = ChromeAppDaemon;