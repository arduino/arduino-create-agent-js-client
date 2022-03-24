"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

var SocketDaemonV2 = /*#__PURE__*/function () {
  function SocketDaemonV2(daemonURL) {
    _classCallCheck(this, SocketDaemonV2);

    this.daemonURL = "".concat(daemonURL, "/v2");
  } // init tries an HEAD


  _createClass(SocketDaemonV2, [{
    key: "init",
    value: function init() {
      return fetch("".concat(this.daemonURL, "/pkgs/tools/installed"), {
        method: 'HEAD'
      }).then(function (res) {
        if (res.status !== 200) {
          throw Error('v2 not available');
        }

        return res;
      });
    } // installedTools uses the new v2 apis to ask the daemon a list of the tools already present in the system

  }, {
    key: "installedTools",
    value: function installedTools() {
      return fetch("".concat(this.daemonURL, "/pkgs/tools/installed"), {
        method: 'GET'
      }).then(function (res) {
        return res.json();
      });
    } // installTool uses the new v2 apis to ask the daemon to download a specific tool on the system
    // The expected payload is
    // {
    //   "name": "avrdude",
    //   "version": "6.3.0-arduino9",
    //   "packager": "arduino",
    //   "url": "https://downloads.arduino.cc/...", // system-specific package containing the tool
    //   "signature": "e7Gh8309...",  // proof that the url comes from a trusted source
    //   "checksum": "SHA256:90384nhfoso8..." // proof that the package wasn't tampered with
    // }

  }, {
    key: "installTool",
    value: function installTool(payload) {
      return fetch("".concat(this.daemonURL, "/pkgs/tools/installed"), {
        method: 'POST',
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok) {
            var error = _objectSpread(_objectSpread({}, json), {}, {
              status: res.status,
              statusText: res.statusText
            });

            return Promise.reject(error);
          }

          return json;
        });
      });
    }
  }]);

  return SocketDaemonV2;
}();

exports["default"] = SocketDaemonV2;