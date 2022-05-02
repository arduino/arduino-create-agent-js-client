"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _operators = require("rxjs/operators");

var _daemon = _interopRequireDefault(require("./daemon"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

/**
 * WARNING: the WebSerialDaemon with support for the Web Serial API is still in an alpha version.
 * At the moment it doesn't implement all the features available in the Chrome App Deamon
 * Use at your own risk.
 *
 * The `channel` parameter in the constructor is the component which is
 * used to interact with the Web Serial API.
 * It must provide a method `upload`.
 */
// const CDC_RESET_NOPE = 'CDC_RESET_NOPE';
// const CDC_RESET_IN_PROGRESS = 'CDC_RESET_IN_PROGRESS';
// const CDC_RESET_DONE = 'CDC_RESET_DONE';
// const CDC_RESET_ERROR = 'CDC_RESET_ERROR';
var WebSerialDaemon = /*#__PURE__*/function (_Daemon) {
  _inherits(WebSerialDaemon, _Daemon);

  var _super = _createSuper(WebSerialDaemon);

  function WebSerialDaemon(boardsUrl, channel) {
    var _this;

    _classCallCheck(this, WebSerialDaemon);

    _this = _super.call(this, boardsUrl);
    _this.port = null;

    _this.channelOpenStatus.next(true);

    _this.channel = channel; // channel is injected from the webide

    _this.connectedPorts = []; // this.cdcResetOperation = new BehaviorSubject({ status: CDC_RESET_NOPE });
    // this.cdcResetInProgress = this.cdcResetOperation.pipe(filter(upload => upload.status === CDC_RESET_IN_PROGRESS));
    // this.cdcResetDone = this.cdcResetOperation.pipe(
    //   filter(upload => upload.status === CDC_RESET_DONE),
    //   first(),
    //   takeUntil(
    //     this.cdcResetOperation.pipe(
    //       filter(upload => upload.status === CDC_RESET_ERROR || upload.status === CDC_RESET_DONE)
    //     )
    //   )
    // );
    // this.cdcResetError = this.cdcResetOperation.pipe(filter(upload => upload.status === CDC_RESET_ERROR))
    //   .pipe(first())
    //   .pipe(takeUntil(this.cdcResetDone));

    _this.init();

    return _this;
  }

  _createClass(WebSerialDaemon, [{
    key: "init",
    value: function init() {
      var _this2 = this;

      this.agentFound.pipe((0, _operators.distinctUntilChanged)()).subscribe(function (found) {
        console.dir('******** BEGIN: web-serial-daemon:34 ********');
        console.dir('agent found?', {
          depth: null,
          colors: true
        });
        console.dir(found, {
          depth: null,
          colors: true
        });
        console.dir('********   END: web-serial-daemon:34 ********');

        if (!found) {
          // Set channelOpen false for the first time
          if (_this2.channelOpen.getValue() === null) {
            _this2.channelOpen.next(false);
          }

          _this2.connectToChannel();
        } else {
          _this2.openChannel(function () {
            return _this2.channel.postMessage({
              command: 'listPorts'
            });
          });
        }
      }); // this.agentFound
      //   .pipe(distinctUntilChanged((prev, curr) => {
      //     console.dir('******** BEGIN: web-serial-daemon:36 ********');
      //     console.dir(prev, { depth: null, colors: true });
      //     console.dir(curr, { depth: null, colors: true });
      //     console.dir('********   END: web-serial-daemon:36 ********');
      //     return prev === curr;
      //   }))
      //   .subscribe(agentFound => {
      //     console.dir('******** BEGIN: web-serial-daemon:37 ********');
      //     console.dir(agentFound, { depth: null, colors: true });
      //     console.dir('********   END: web-serial-daemon:37 ********');
      //     if (!agentFound) {
      //       this.findApp();
      //     }
      //   });
    }
  }, {
    key: "connectToChannel",
    value: function connectToChannel() {
      var _this3 = this;

      this.channel.onMessage(function (message) {
        if (message.version) {
          _this3.agentInfo = {
            version: message.version,
            os: 'ChromeOS'
          };

          _this3.agentFound.next(true);

          _this3.channelOpen.next(true);
        } else {
          _this3.appMessages.next(message);
        }
      });
      this.channel.onDisconnect(function () {
        _this3.channelOpen.next(false);

        _this3.agentFound.next(false);
      }); // this.agentFound.next(true);
      // interval(POLLING_INTERVAL)
      //   .pipe(
      //     take(5),
      //     map(res => {
      //       console.dir('******** BEGIN: web-serial-daemon:57 ********');
      //       console.dir(res, { depth: null, colors: true });
      //       console.dir('********   END: web-serial-daemon:57 ********');
      //       return res;
      //     }),
      //   )
      //   .pipe(takeUntil(this.channelOpen.pipe(filter(status => status))))
      //   .subscribe(() => {
      //     console.dir('******** BEGIN: web-serial-daemon:50 ********');
      //     console.dir('trying to connect', { depth: null, colors: true });
      //     console.dir('********   END: web-serial-daemon:50 ********');
      //     this._appConnect();
      //   });
    }
  }, {
    key: "_appConnect",
    value: function _appConnect() {
      var _this4 = this;

      this.channel.onMessage(function (message) {
        if (message.version) {
          _this4.agentInfo = {
            version: message.version,
            os: 'ChromeOS'
          };

          _this4.agentFound.next(true);

          _this4.channelOpen.next(true);
        } else {
          _this4.appMessages.next(message);
        }
      });
      this.channel.onDisconnect(function () {
        _this4.channelOpen.next(false);

        _this4.agentFound.next(false);
      });
    }
  }, {
    key: "handleAppMessage",
    value: function handleAppMessage(message) {
      if (message.ports) {
        this.handleListMessage(message);
      } else if (message.supportedBoards) {
        this.supportedBoards.next(message.supportedBoards);
      }

      if (message.serialData) {
        this.serialMonitorMessages.next(message.serialData);
      }

      if (message.uploadStatus) {
        console.dir('******** BEGIN: web-serial-daemon:160 ********');
        console.dir(message, {
          depth: null,
          colors: true
        });
        console.dir('********   END: web-serial-daemon:160 ********');
        this.handleUploadMessage(message);
      }

      if (message.err) {
        this.uploading.next({
          status: this.UPLOAD_ERROR,
          err: message.Err
        });
      } // else if (message.connectedSerialPort) {
      //   const port = this.uploader.getBoardInfoFromSerialPort(message.connectedSerialPort);
      //   this.connectedPorts.push(port);
      //   this.devicesList.next({
      //     serial: this.connectedPorts,
      //     network: []
      //   });
      // }
      // else if (message.disconnectedSerialPort) {
      //   const port = this.uploader.getBoardInfoFromSerialPort(message.disconnectedSerialPort);
      //   this.connectedPorts = this.connectedPorts.filter(connectedPort => connectedPort.Name !== port.Name);
      //   this.devicesList.next({
      //     serial: this.connectedPorts,
      //     network: []
      //   });
      // }

    } // handleCdcResetMessage(message) {
    //   if (this.cdcResetOperation.getValue().status !== CDC_RESET_IN_PROGRESS) {
    //     return;
    //   }
    //   switch (message.uploadStatus) {
    //     case 'error':
    //       this.cdcResetOperation.next({ status: CDC_RESET_ERROR, msg: message.message });
    //       break;
    //     case 'success':
    //       this.cdcResetOperation.next({ status: CDC_RESET_DONE, msg: message.message });
    //       break;
    //     default:
    //       this.cdcResetOperation.next({ status: CDC_RESET_IN_PROGRESS });
    //   }
    // }

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
  }, {
    key: "handleListMessage",
    value: function handleListMessage(message) {
      var lastDevices = this.devicesList.getValue();

      if (!_daemon["default"].devicesListAreEquals(lastDevices.serial, message.ports)) {
        this.devicesList.next({
          serial: message.ports // .filter(port => Boolean(port.vendorId))
          .map(function (port) {
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
      } else {
        console.dir('******** BEGIN: web-serial-daemon:133 ********');
        console.dir('device list is different', {
          depth: null,
          colors: true
        });
        console.dir(lastDevices.serial, {
          depth: null,
          colors: true
        });
        console.dir(message.ports, {
          depth: null,
          colors: true
        });
        console.dir('********   END: web-serial-daemon:133 ********');
      }
    }
    /**
     * Send 'close' command to all the available serial ports
     */
    // eslint-disable-next-line class-methods-use-this

  }, {
    key: "closeAllPorts",
    value: function closeAllPorts() {
      console.log('should be closing serial ports here'); // this.uploader.closeAllPorts();
    }
    /**
     * Request serial port open
     * @param {string} port the port name
     */

  }, {
    key: "openSerialMonitor",
    value: function openSerialMonitor(port, baudrate) {
      var _this5 = this;

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
          _this5.serialMonitorOpened.next(true);
        }

        if (message.portOpenStatus === 'error') {
          _this5.serialMonitorError.next("Failed to open serial ".concat(port));
        }
      });
      this.channel.postMessage({
        command: 'openPort',
        data: {
          name: port,
          baudrate: baudrate
        }
      }); // this.uploader.openPort(serialPort)
      //   .then(ports => {
      //     this.appMessages.next({ portOpenStatus: 'success' });
      //     this.appMessages.next({ ports });
      //   })
      //   .catch(() => this.appMessages.next({ portOpenStatus: 'error' }));
    }
  }, {
    key: "closeSerialMonitor",
    value: function closeSerialMonitor(port) {
      var _this6 = this;

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
          _this6.serialMonitorOpened.next(false);
        }

        if (message.portCloseStatus === 'error') {
          _this6.serialMonitorError.next("Failed to close serial ".concat(port));
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
    key: "cdcReset",
    value: function cdcReset(_ref) {
      var fqbn = _ref.fqbn;
      this.uploading.next({
        status: this.UPLOAD_IN_PROGRESS,
        msg: 'CDC reset started'
      });
      this.channel.postMessage({
        command: 'cdcReset',
        data: {
          fqbn: fqbn
        }
      }); // return this.uploader.cdcReset({ fqbn })
      //   .then(() => {
      //     this.uploading.next({ status: this.CDC_RESET_DONE, msg: 'Touch operation succeeded' });
      //   })
      //   .catch(error => {
      //     this.notifyUploadError(error.message);
      //   });
    }
    /** A proxy method to get info from the specified SerialPort object */

  }, {
    key: "getBoardInfoFromSerialPort",
    value: function getBoardInfoFromSerialPort(serialPort) {
      return this.uploader.getBoardInfoFromSerialPort(serialPort);
    }
  }, {
    key: "connectToSerialDevice",
    value: function connectToSerialDevice() {
      return this.uploader.connectToSerialDevice();
    }
    /**
     * @param {object} uploadPayload
     * TODO: document param's shape
     */

  }, {
    key: "_upload",
    value: function _upload(uploadPayload) {
      var _this7 = this;

      return this.uploader.upload(uploadPayload).then(function () {
        _this7.uploading.next({
          status: _this7.UPLOAD_DONE,
          msg: 'Sketch uploaded'
        });
      })["catch"](function (error) {
        _this7.notifyUploadError(error.message);
      });
    }
  }]);

  return WebSerialDaemon;
}(_daemon["default"]);

exports["default"] = WebSerialDaemon;