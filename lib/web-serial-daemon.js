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
 * The `uploader` parameter in the constructor is the component which is
 * used to interact with the Web Serial API.
 * It must provide a method `upload`.
 */
var WebSerialDaemon = /*#__PURE__*/function (_Daemon) {
  _inherits(WebSerialDaemon, _Daemon);

  var _super = _createSuper(WebSerialDaemon);

  function WebSerialDaemon(boardsUrl, uploader) {
    var _this;

    _classCallCheck(this, WebSerialDaemon);

    _this = _super.call(this, boardsUrl);
    _this.port = null;

    _this.agentFound.next(true);

    _this.channelOpenStatus.next(true);

    _this.uploader = uploader;
    _this.connectedPorts = [];

    _this.init();

    return _this;
  }

  _createClass(WebSerialDaemon, [{
    key: "init",
    value: function init() {
      var _this2 = this;

      var supportedBoards = this.uploader.getSupportedBoards();
      this.appMessages.next({
        supportedBoards: supportedBoards
      });
      this.uploader.listBoards().then(function (ports) {
        _this2.connectedPorts = ports;

        _this2.appMessages.next({
          ports: ports
        });
      });
    } // eslint-disable-next-line class-methods-use-this

  }, {
    key: "closeSerialMonitor",
    value: function closeSerialMonitor() {// TODO: it's a NO OP at the moment
    }
  }, {
    key: "handleAppMessage",
    value: function handleAppMessage(message) {
      if (message.ports) {
        this.devicesList.next({
          serial: message.ports,
          network: []
        });
      } else if (message.supportedBoards) {
        this.supportedBoards.next(message.supportedBoards);
      } else if (message.connectedSerialPort) {
        var port = this.uploader.getBoardInfoFromSerialPort(message.connectedSerialPort);
        this.connectedPorts.push(port);
        this.devicesList.next({
          serial: this.connectedPorts,
          network: []
        });
      } else if (message.disconnectedSerialPort) {
        var _port = this.uploader.getBoardInfoFromSerialPort(message.disconnectedSerialPort);

        this.connectedPorts = this.connectedPorts.filter(function (connectedPort) {
          return connectedPort.Name !== _port.Name;
        });
        this.devicesList.next({
          serial: this.connectedPorts,
          network: []
        });
      }
    }
    /**
     * Send 'close' command to all the available serial ports
     */
    // eslint-disable-next-line class-methods-use-this

  }, {
    key: "closeAllPorts",
    value: function closeAllPorts() {
      console.log('should be closing serial ports here');
    }
    /**
     * Request serial port open
     * @param {string} port the port name
     */

  }, {
    key: "openSerialMonitor",
    value: function openSerialMonitor(port) {
      var _this3 = this;

      if (this.serialMonitorOpened.getValue()) {
        return;
      }

      var serialPort = this.devicesList.getValue().serial[0]; // .find(p => p.Name === port);

      if (!serialPort) {
        return this.serialMonitorError.next("Can't find port ".concat(port));
      }

      this.appMessages.pipe((0, _operators.takeUntil)(this.serialMonitorOpened.pipe((0, _operators.filter)(function (open) {
        return open;
      })))).subscribe(function (message) {
        if (message.portOpenStatus === 'success') {
          _this3.serialMonitorOpened.next(true);
        }

        if (message.portOpenStatus === 'error') {
          _this3.serialMonitorError.next("Failed to open serial ".concat(port));
        }
      });
    }
  }, {
    key: "cdcReset",
    value: function cdcReset(_ref) {
      var _this4 = this;

      var fqbn = _ref.fqbn;
      return this.uploader.cdcReset({
        fqbn: fqbn
      }).then(function () {
        _this4.uploading.next({
          status: _this4.CDC_RESET_DONE,
          msg: 'Touch operation succeeded'
        });
      })["catch"](function (error) {
        _this4.notifyUploadError(error.message);
      });
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
      var _this5 = this;

      return this.uploader.upload(uploadPayload).then(function () {
        _this5.uploading.next({
          status: _this5.UPLOAD_DONE,
          msg: 'Sketch uploaded'
        });
      })["catch"](function (error) {
        _this5.notifyUploadError(error.message);
      });
    }
  }]);

  return WebSerialDaemon;
}(_daemon["default"]);

exports["default"] = WebSerialDaemon;