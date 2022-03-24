"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _socket = _interopRequireDefault(require("socket.io-client"));

var _semverCompare = _interopRequireDefault(require("semver-compare"));

var _detectBrowser = require("detect-browser");

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _daemon = _interopRequireDefault(require("./daemon"));

var _socketDaemon = _interopRequireDefault(require("./socket-daemon.v2"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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

// Required agent version
var browser = (0, _detectBrowser.detect)();
var POLLING_INTERVAL = 3500;
var UPLOAD_DONE_TIMER = 5000;
var PROTOCOL = {
  HTTP: 'http',
  HTTPS: 'https'
};
var LOOPBACK_ADDRESS = "".concat(PROTOCOL.HTTP, "://127.0.0.1");
var LOOPBACK_HOST = "".concat(PROTOCOL.HTTPS, "://localhost");
var LOOKUP_PORT_START = 8991;
var LOOKUP_PORT_END = 9000;
var orderedPluginAddresses = [LOOPBACK_ADDRESS, LOOPBACK_HOST];
var driversRequested = false;
var CANT_FIND_AGENT_MESSAGE = 'Arduino Create Agent cannot be found';
var updateAttempts = 0;

if (browser.name !== 'chrome' && browser.name !== 'firefox') {
  orderedPluginAddresses = [LOOPBACK_HOST, LOOPBACK_ADDRESS];
}

var SocketDaemon = /*#__PURE__*/function (_Daemon) {
  _inherits(SocketDaemon, _Daemon);

  var _super = _createSuper(SocketDaemon);

  function SocketDaemon(boardsUrl) {
    var _this;

    _classCallCheck(this, SocketDaemon);

    _this = _super.call(this, boardsUrl);
    _this.selectedProtocol = PROTOCOL.HTTP;
    _this.socket = null;
    _this.pluginURL = null;
    _this.disabled = false;

    _this.openChannel(function () {
      return _this.socket.emit('command', 'list');
    });

    _this.agentV2Found = new _rxjs.BehaviorSubject(null);

    _this.agentFound.subscribe(function (agentFound) {
      if (agentFound) {
        _this._wsConnect();

        var v2 = new _socketDaemon["default"](_this.pluginURL);
        v2.init().then(function () {
          _this.v2 = v2;

          _this.agentV2Found.next(_this.v2);
        });
      } else {
        _this.findAgent();
      }
    });

    return _this;
  }

  _createClass(SocketDaemon, [{
    key: "initSocket",
    value: function initSocket() {
      var _this2 = this;

      this.socket.on('message', function (message) {
        try {
          _this2.appMessages.next(JSON.parse(message));
        } catch (SyntaxError) {
          _this2.appMessages.next(message);
        }
      });
    }
  }, {
    key: "notifyDownloadError",
    value: function notifyDownloadError(err) {
      this.downloading.next({
        status: this.DOWNLOAD_ERROR,
        err: err
      });
    }
    /**
     * Look for the agent endpoint.
     * First search in LOOPBACK_ADDRESS, after in LOOPBACK_HOST if in Chrome or Firefox, otherwise vice versa.
     */

  }, {
    key: "findAgent",
    value: function findAgent() {
      var _this3 = this;

      if (this.disabled) {
        return;
      }

      if (this.pluginURL) {
        fetch("".concat(this.pluginURL, "/info")).then(function (response) {
          return response.json().then(function (data) {
            _this3.agentInfo = data;

            _this3.agentFound.next(true);
          });
        })["catch"](function () {
          return (0, _rxjs.timer)(POLLING_INTERVAL).subscribe(function () {
            _this3.pluginURL = null;

            _this3.findAgent();
          });
        });
        return;
      }

      this._tryPorts(orderedPluginAddresses[0])["catch"](function () {
        return _this3._tryPorts(orderedPluginAddresses[1]);
      }).then(function () {
        return _this3.agentFound.next(true);
      })["catch"](function () {
        return (0, _rxjs.timer)(POLLING_INTERVAL).subscribe(function () {
          return _this3.findAgent();
        });
      });
    }
    /**
     * Try ports for the selected host. From LOOKUP_PORT_START to LOOKUP_PORT_END
     * @param {string} host - The host value (LOOPBACK_ADDRESS or LOOPBACK_HOST).
     * @return {Promise} info - A promise resolving with the agent info values.
     */

  }, {
    key: "_tryPorts",
    value: function _tryPorts(host) {
      var _this4 = this;

      var pluginLookups = [];

      for (var port = LOOKUP_PORT_START; port < LOOKUP_PORT_END; port += 1) {
        pluginLookups.push(fetch("".concat(host, ":").concat(port, "/info")).then(function (response) {
          return response.json().then(function (data) {
            return {
              response: response,
              data: data
            };
          });
        })["catch"](function () {
          return Promise.resolve(false);
        })); // We expect most of those call to fail, because there's only one agent
        // So we have to resolve them with a false value to let the Promise.all catch all the deferred data
      }

      return Promise.all(pluginLookups).then(function (responses) {
        var found = responses.some(function (r) {
          if (r && r.response && r.response.status === 200) {
            _this4.agentInfo = r.data;

            if (_this4.agentInfo.update_url.indexOf('downloads.arduino.cc') === -1) {
              _this4.error.next('unofficial plugin');
            }

            if (r.response.url.indexOf(PROTOCOL.HTTPS) === 0) {
              _this4.selectedProtocol = PROTOCOL.HTTPS;
            } else {
              // Protocol http, force 127.0.0.1 for old agent versions too
              _this4.agentInfo[_this4.selectedProtocol] = _this4.agentInfo[_this4.selectedProtocol].replace('localhost', '127.0.0.1');
            }

            _this4.pluginURL = _this4.agentInfo[_this4.selectedProtocol];
            return true;
          }

          return false;
        });

        if (found) {
          return fetch('https://s3.amazonaws.com/arduino-create-static/agent-metadata/agent-version.json').then(function (response) {
            return response.json().then(function (data) {
              if (_this4.agentInfo.version && ((0, _semverCompare["default"])(_this4.agentInfo.version, data.Version) === 0 || _this4.agentInfo.version.indexOf('dev') !== -1 || _this4.agentInfo.version.indexOf('rc') !== -1)) {
                return _this4.agentInfo;
              }

              if (updateAttempts === 0) {
                return _this4.update();
              }

              if (updateAttempts < 3) {
                return (0, _rxjs.timer)(10000).subscribe(function () {
                  return _this4.update();
                });
              }

              updateAttempts += 1;

              _this4.error.next('plugin version incompatible');

              return Promise.reject(new Error('plugin version incompatible'));
            });
          }) // If version API broken, go ahead with current version
          ["catch"](function () {
            return _this4.agentInfo;
          });
        } // Set channelOpen false for the first time


        if (_this4.channelOpen.getValue() === null) {
          _this4.channelOpen.next(false);
        }

        return Promise.reject(new Error("".concat(CANT_FIND_AGENT_MESSAGE, " at ").concat(host)));
      });
    }
    /**
     * Uses the websocket protocol to connect to the agent
     */

  }, {
    key: "_wsConnect",
    value: function _wsConnect() {
      var _this5 = this;

      var wsProtocol = this.selectedProtocol === PROTOCOL.HTTPS ? 'wss' : 'ws';
      var address = this.agentInfo[wsProtocol]; // Reset

      if (this.socket) {
        this.socket.destroy();
        delete this.socket;
        this.socket = null;
      }

      this.socket = (0, _socket["default"])(address);
      this.socket.on('connect', function () {
        // On connect download windows drivers which are indispensable for detection of boards
        if (!driversRequested) {
          _this5.downloadTool('windows-drivers', 'latest', 'arduino');

          _this5.downloadTool('bossac', '1.7.0', 'arduino');

          _this5.downloadTool('fwupdater', 'latest', 'arduino');

          _this5.downloadTool('rp2040tools', 'latest', 'arduino');

          driversRequested = false;
        }

        _this5.initSocket();

        _this5.channelOpen.next(true);
      });
      this.socket.on('error', function (error) {
        _this5.socket.disconnect();

        _this5.error.next(error);
      });
      this.socket.on('disconnect', function () {
        _this5.socket.disconnect();

        _this5.channelOpen.next(false);
      });
    }
  }, {
    key: "handleAppMessage",
    value: function handleAppMessage(message) {
      // Result of a list command
      if (message.Ports) {
        this.handleListMessage(message);
      } // Serial monitor message


      if (message.D) {
        this.serialMonitorMessages.next(message.D);
        this.serialMonitorMessagesWithPort.next(message);
      }

      if (message.ProgrammerStatus) {
        this.handleUploadMessage(message);
      }

      if (message.DownloadStatus) {
        this.handleDownloadMessage(message);
      }

      if (message.Err) {
        this.uploading.next({
          status: this.UPLOAD_ERROR,
          err: message.Err
        });
      }

      if (message.Error) {
        if (message.Error.indexOf('trying to close') !== -1) {
          // https://github.com/arduino/arduino-create-agent#openclose-ports
          this.serialMonitorOpened.next(false);
        }
      }
    }
  }, {
    key: "handleListMessage",
    value: function handleListMessage(message) {
      var lastDevices = this.devicesList.getValue();

      if (message.Network && !_daemon["default"].devicesListAreEquals(lastDevices.network, message.Ports)) {
        this.devicesList.next({
          serial: lastDevices.serial,
          network: message.Ports
        });
      } else if (!message.Network && !_daemon["default"].devicesListAreEquals(lastDevices.serial, message.Ports)) {
        this.devicesList.next({
          serial: message.Ports,
          network: lastDevices.network
        });
      }
    }
    /**
     * Check the agent version and call the update if needed.
     */

  }, {
    key: "update",
    value: function update() {
      var _this6 = this;

      return fetch("".concat(this.agentInfo[this.selectedProtocol], "/update"), {
        method: 'POST'
      }).then(function (result) {
        return result.json();
      }).then(function (response) {
        if (response && response.error && (response.error.indexOf('proxy') !== -1 || response.error.indexOf('dial tcp') !== -1)) {
          _this6.error.next('proxy error');

          return new Error('proxy error');
        } // We reject the promise because the daemon will be restarted, we need to continue looking for the port


        return Promise.reject();
      })["catch"](function () {
        console.log('update plugin failed');
      });
    }
    /**
     * Pauses the plugin
     * @return {Promise}
     */

  }, {
    key: "stopPlugin",
    value: function stopPlugin() {
      if (this.agentFound.getValue()) {
        return fetch("".concat(this.agentInfo[this.selectedProtocol], "/pause"), {
          method: 'POST'
        });
      }
    }
    /**
     * Send 'close' command to all the available serial ports
     */

  }, {
    key: "closeAllPorts",
    value: function closeAllPorts() {
      var _this7 = this;

      var devices = this.devicesList.getValue().serial;
      devices.forEach(function (device) {
        _this7.socket.emit('command', "close ".concat(device.Name));
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
      this.socket.emit('command', "send ".concat(port, " ").concat(message));
    }
    /**
     * Request serial port open
     * @param {string} port the port name
     */

  }, {
    key: "openSerialMonitor",
    value: function openSerialMonitor(port) {
      var _this8 = this;

      var baudrate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 9600;
      var serialPort = this.devicesList.getValue().serial.find(function (p) {
        return p.Name === port;
      });

      if (!serialPort) {
        return this.serialMonitorError.next("Can't find board at ".concat(port));
      }

      if (this.uploading.getValue().status === this.UPLOAD_IN_PROGRESS || serialPort.IsOpen) {
        return;
      }

      this.appMessages.pipe((0, _operators.takeUntil)(this.serialMonitorOpened.pipe((0, _operators.filter)(function (open) {
        return open;
      })))).subscribe(function (message) {
        if (message.Cmd === 'Open') {
          _this8.serialMonitorOpened.next(true);
        }

        if (message.Cmd === 'OpenFail') {
          _this8.serialMonitorError.next("Failed to open serial monitor at ".concat(port));
        }
      });
      this.socket.emit('command', "open ".concat(port, " ").concat(baudrate, " timed"));
    }
    /**
     * Request serial port close
     * @param {string} port the port name
     */

  }, {
    key: "closeSerialMonitor",
    value: function closeSerialMonitor(port) {
      var _this9 = this;

      var serialPort = this.devicesList.getValue().serial.find(function (p) {
        return p.Name === port;
      });

      if (!serialPort || !serialPort.IsOpen) {
        return;
      }

      this.appMessages.pipe((0, _operators.takeUntil)(this.serialMonitorOpened.pipe((0, _operators.filter)(function (open) {
        return !open;
      })))).subscribe(function (message) {
        if (message.Cmd === 'Close') {
          _this9.serialMonitorOpened.next(false);
        }

        if (message.Cmd === 'CloseFail') {
          _this9.serialMonitorError.next("Failed to close serial monitor at ".concat(port));
        }
      });
      this.socket.emit('command', "close ".concat(port));
    }
  }, {
    key: "handleUploadMessage",
    value: function handleUploadMessage(message) {
      var _this10 = this;

      if (message.Flash === 'Ok' && message.ProgrammerStatus === 'Done') {
        // After the upload is completed the port goes down for a while, so we have to wait a few seconds
        return (0, _rxjs.timer)(UPLOAD_DONE_TIMER).subscribe(function () {
          return _this10.uploading.next({
            status: _this10.UPLOAD_DONE,
            msg: message.Flash
          });
        });
      }

      switch (message.ProgrammerStatus) {
        case 'Starting':
          this.uploading.next({
            status: this.UPLOAD_IN_PROGRESS,
            msg: "Programming with: ".concat(message.Cmd)
          });
          break;

        case 'Busy':
          this.uploading.next({
            status: this.UPLOAD_IN_PROGRESS,
            msg: message.Msg
          });
          break;

        case 'Error':
          this.uploading.next({
            status: this.UPLOAD_ERROR,
            err: message.Msg
          });
          break;

        case 'Killed':
          this.uploading.next({
            status: this.UPLOAD_IN_PROGRESS,
            msg: "terminated by user"
          });
          this.uploading.next({
            status: this.UPLOAD_ERROR,
            err: "terminated by user"
          });
          break;

        case 'Error 404 Not Found':
          this.uploading.next({
            status: this.UPLOAD_ERROR,
            err: message.Msg
          });
          break;

        default:
          this.uploading.next({
            status: this.UPLOAD_IN_PROGRESS,
            msg: message.Msg
          });
      }
    }
  }, {
    key: "handleDownloadMessage",
    value: function handleDownloadMessage(message) {
      switch (message.DownloadStatus) {
        case 'Pending':
          this.downloading.next({
            status: this.DOWNLOAD_IN_PROGRESS,
            msg: message.Msg
          });
          break;

        case 'Success':
          this.downloading.next({
            status: this.DOWNLOAD_DONE,
            msg: message.Msg
          });
          break;

        case 'Error':
          this.downloading.next({
            status: this.DOWNLOAD_ERROR,
            err: message.Msg
          });
          break;

        default:
          this.downloading.next({
            status: this.DOWNLOAD_IN_PROGRESS,
            msg: message.Msg
          });
      }
    }
    /**
     * Perform an upload via http on the daemon
     * @param {Object} data
     */

  }, {
    key: "daemonUpload",
    value: function daemonUpload(data) {
      var _this11 = this;

      fetch("".concat(this.pluginURL, "/upload"), {
        method: 'POST',
        body: JSON.stringify(data)
      }).then(function (result) {
        if (!result.ok) {
          _this11.uploading.next({
            status: _this11.UPLOAD_ERROR,
            err: result.statusText
          });
        }
      })["catch"](function (error) {
        _this11.uploading.next({
          status: _this11.UPLOAD_ERROR,
          err: error
        });
      });
    }
    /**
     * Upload compiled sketch to serial target
     * @param {Object} uploadPayload payload properties defined in parent
     * @param {Object} uploadCommandInfo = {
     *  commandline: "commandline to execute, for serial upload",
        signature: "signature of the commandline",
     *  options: {
     *    wait_for_upload_port: true or false,
     *    use_1200bps_touch: true or false,
     *  },
     *  tools: [{
     *      name: 'avrdude',
     *      packager: 'arduino',
     *      version '6.3.0-arduino9'
     *    },
     *    {...}
     *  ]
     * }
     */

  }, {
    key: "_upload",
    value: function _upload(uploadPayload, uploadCommandInfo) {
      var _this12 = this;

      // Wait for tools to be installed
      var promises = [];

      if (Array.isArray(uploadCommandInfo.tools)) {
        uploadCommandInfo.tools.forEach(function (tool) {
          if (_this12.v2) {
            _this12.downloading.next({
              status: _this12.DOWNLOAD_IN_PROGRESS
            });

            promises.push(_this12.v2.installTool(tool).then(function () {
              _this12.downloading.next({
                status: _this12.DOWNLOAD_DONE
              });
            }));
          } else {
            _this12.downloadTool(tool.name, tool.version, tool.packager);
          }
        });
      }

      var socketParameters = _objectSpread(_objectSpread({}, uploadPayload), {}, {
        extra: _objectSpread(_objectSpread({}, uploadPayload.extra), {}, {
          wait_for_upload_port: uploadCommandInfo.options.wait_for_upload_port === 'true' || uploadCommandInfo.options.wait_for_upload_port === true,
          use_1200bps_touch: uploadCommandInfo.options.use_1200bps_touch === 'true' || uploadCommandInfo.options.use_1200bps_touch === true
        }),
        extrafiles: uploadCommandInfo.files || [] // Consider to push extra resource files from sketch in future if feature requested (from data folder)

      });

      if (!socketParameters.extra.network) {
        socketParameters.signature = uploadCommandInfo.signature;
      }

      Promise.all(promises).then(function () {
        _this12.serialMonitorOpened.pipe((0, _operators.filter)(function (open) {
          return !open;
        })).pipe((0, _operators.first)()).subscribe(function () {
          _this12.daemonUpload(socketParameters);
        });
      });
      this.downloadingError.subscribe(function (error) {
        return _this12.uploading.next({
          status: _this12.UPLOAD_ERROR,
          err: error
        });
      });
    }
    /**
     * Upload compiled sketch to network target
     * @param {Object} target = {
     *    board: 'fqbn',
     *    port: 'ip address',
     *    extra: {},
     * }
     * @param {string} sketchName
     * @param {Object} compilationResult
     */

  }, {
    key: "uploadNetwork",
    value: function uploadNetwork(target, sketchName, compilationResult) {
      this.uploading.next({
        status: this.UPLOAD_IN_PROGRESS
      });

      var uploadPayload = _objectSpread(_objectSpread({}, target), {}, {
        filename: "".concat(sketchName, ".hex"),
        hex: compilationResult.hex
      });

      this.daemonUpload(uploadPayload);
    }
    /**
     * Upload file to network target (arduino-connector)
     * @param {Object} target
     * @param {string} sketchName
     * @param {Object} encodedFile
     * @param {Object} commandData {commandline: '', signature: ''}
     */

  }, {
    key: "uploadConnector",
    value: function uploadConnector(target, sketchName, encodedFile, commandData) {
      this.uploading.next({
        status: this.UPLOAD_IN_PROGRESS
      });

      var uploadPayload = _objectSpread(_objectSpread({}, target), {}, {
        commandline: commandData.commandline,
        signature: commandData.signature,
        filename: sketchName,
        hex: encodedFile
      });

      this.daemonUpload(uploadPayload);
    }
    /**
     * Download tool
     * @param {string} toolName
     * @param {string} toolVersion
     * @param {string} packageName
     * @param {string} replacementStrategy
     */

  }, {
    key: "downloadTool",
    value: function downloadTool(toolName, toolVersion, packageName) {
      var replacementStrategy = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'keep';
      this.downloading.next({
        status: this.DOWNLOAD_IN_PROGRESS
      });
      this.socket.emit('command', "downloadtool ".concat(toolName, " ").concat(toolVersion, " ").concat(packageName, " ").concat(replacementStrategy));
    }
    /**
     * Interrupt upload
     */

  }, {
    key: "stopUploadCommand",
    value: function stopUploadCommand() {
      this.uploading.next({
        status: this.UPLOAD_ERROR,
        err: 'upload stopped'
      });
      this.socket.emit('command', 'killupload');
    }
  }, {
    key: "disable",
    value: function disable() {
      this.disabled = true;
    }
  }, {
    key: "enable",
    value: function enable() {
      this.disable = false;
      this.findAgent();
    }
  }]);

  return SocketDaemon;
}(_daemon["default"]);

exports["default"] = SocketDaemon;