/*
 * This file is part of create-plugin-communication.
 *
 * Copyright 2018 Arduino AG (http://www.arduino.cc/)
 *
 * create-plugin-communication is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * As a special exception, you may use this file as part of a free software
 * library without restriction.  Specifically, if other files instantiate
 * templates or use macros or inline functions from this file, or you compile
 * this file and link it with other files to produce an executable, this
 * file does not by itself cause the resulting executable to be covered by
 * the GNU General Public License.  This exception does not however
 * invalidate any other reasons why the executable file might be covered by
 * the GNU General Public License.
 */

import { Deferred } from './readMessages';

let port = null;
let polling;

let uploading = false;

const callbacks = {
  ports: [],
  program: [],
  serial: []
};

const promises = {
  open: [],
  close: []
};

let disconnected = true;

let connectCb = null;
let disconnectCb = null;
let errorCb = null;
let boardsCb = null;

// Sends the data to all the registered callbacks
const callback = (name, data) => {
  if (!callbacks || !callbacks[name] || !callbacks[name].length) {
    return;
  }
  for (const i in callbacks[name]) {
    callbacks[name][i](data);
  }
}

const onMessage = (msg) => {
  if (msg.version) {
    if (!polling) {
      polling = setInterval(() => {
        if (!uploading) {
          port.postMessage({
            command: 'listPorts'
          });
        }
      }, 1500);
    }
    disconnected = false;
    connectCb();
  } else if (msg.supportedBoards) {
    boardsCb(msg.supportedBoards);
  } else if (msg.ports) {
    const ports = msg.ports.map(port => {
      return {
        Name: port.name,
        SerialNumber: port.serialNumber,
        IsOpen: port.isOpen,
        VendorID: port.vendorId,
        ProductID: port.productId
      };
    });

    callback('ports', ports);
  } else if (msg.uploadStatus) {
    if (msg.uploadStatus === 'success') {
      uploading = false;
      callback('program', {done: true});
    } else if (msg.uploadStatus === 'error') {
      uploading = false;

      const errorMessage = msg.message;

      callback('program', {done: true, err: errorMessage + '\n'});

      if (errorMessage === 'Free trial expired') {
        errorCb('freeTrialExpired');
      } else if (errorMessage == 'Unlicensed education user') {
        errorCb('unlicensedEducationUser');
      }
    } else if (msg.uploadStatus === 'message') {
      callback('program', {done: false, msg: msg.message + '\n'});
    }
  } else if (msg.portOpenStatus) {
    if (msg.portOpenStatus === 'success') {
      if (promises.open.length) {
        var promise = promises.open.shift();
        promise.resolve(true);
      }
    } else if (promises.open.length) {
      var promise = promises.open.shift();
      promise.reject(msg.message);
    }
  } else if (msg.portCloseStatus) {
    if (msg.portCloseStatus === 'success') {
      if (promises.close.length) {
        var promise = promises.close.shift();
        promise.resolve(true);
      }
    } else if (promises.close.length) {
      var promise = promises.close.shift();

      promise.reject(msg.message);
    }
  } else if (msg.serialData) {
    callback('serial', {data: msg.serialData});
  }
}

const onChromeDisconnect = () => {
  disconnected = true;

  if (polling) {
    clearInterval(polling);
    polling = undefined;
  }
  disconnectCb();
}

const connect = (chromeExtensionId) => {
  if ( (port === null || disconnected) && chrome.runtime) {
    port = chrome.runtime.connect(chromeExtensionId);
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onChromeDisconnect);
  } else {
    errorCb("chromeExtensionNotFound");
  }
}

const perform = (action, data, cb) => {
  const deferred = new Deferred();

  if (uploading) {
    deferred.reject();

    return deferred.promise;
  }

  if (action === 'req_downloadtool') {
    // Chrome app doesn't support downloading tools, just fail
    deferred.resolve();
  } else if (action === 'req_serial_monitor_open') {
    port.postMessage({
      command: 'openPort',
      data: {
        name: data.com_name,
        baudrate: data.baudrate
      }
    });

    promises.open = deferred;
  } else if (action === 'req_serial_monitor_close') {
    port.postMessage({
      command: 'closePort',
      data: {
        name: data.com_name
      }
    });

    promises.close = deferred;
  } else if (action === 'req_serial_monitor_write') {
    port.postMessage({
      command: 'writePort',
      data: {
        name: data.com_name,
        data: data.data
      }
    });
  }

  return deferred.promise;
}

// Perform an upload via http on the daemon
// file = {name: 'filename', data: 'base64data'}
// target = {
//    board: "name of the board",
//    port: "port of the board",
//    auth_user: "Optional user to use as authentication",
//    auth_pass: "Optional pass to use as authentication"
//    network: true or false
// }
// data = {
//    commandline: "commandline to execute",
//    signature: "signature of the commandline",
//    files: [
//       {name: "Name of a file to upload on the device", data: 'base64data'}
//    ],
//    options: {}
// }
// cb = callback function executing everytime a packet of data arrives
const upload = (target, data, cb) => {
  uploading = true;
  callbacks.program = [cb];

  // At least one file to upload
  if (data.files.length === 0) {
    uploading = false;
    callback('program', {done: true, err: 'You need at least one file to upload'});
    return;
  }

  // Main file
  const file = data.files[0];
  file.name = file.name.split('/');
  file.name = file.name[file.name.length - 1];

  window.oauth.token().then(token => {
    port.postMessage({
      command: 'upload',
      data: {
        filename: file.name,
        data: file.data,
        board: target.board,
        port: target.port,
        commandline: data.commandline,
        token: token.token
      }
    });
  });
}

const onPortsUpdate = (cb) => {
  if (typeof cb === 'function') {
    callbacks.ports.push(cb);
  }
}

const onSerialOutput = (cb) => {
  if (typeof cb === 'function') {
    callbacks.serial.push(cb);
  }
}

const onConnect = (cb) => {
  if (typeof cb === 'function') {
    connectCb = cb;
  }
}

const onDisconnect = (cb) => {
  if (typeof cb === 'function') {
    disconnectCb = cb;
  }
}

const onError = (cb) => {
  if (typeof cb === 'function') {
    errorCb = cb;
  }
}

const onSupportedBoards = (cb) => {
  if (typeof cb === 'function') {
    boardsCb = cb;
  }
}

const DaemonCromeApp = (params) => {

  if (params) {
    onPortsUpdate(params.onPortsUpdate)
    onSerialOutput(params.onSerialOutput);
    onConnect(params.onConnect);
    onDisconnect(params.onDisconnect);
    onError(params.onError);
    onSupportedBoards(params.onSupportedBoards);
  }

  return {
    // Connect the client with the daemon over extension port
    connect,
    perform,
    // Return daemon connection status
    connected: () => !disconnected,
    stopPlugin() {
      // Not supported by the chrome app
    },
    upload,
    stopUpload() {
      // Not supported by the chrome app
    },
    onDisconnect,
    onConnect,
    onPortsUpdate,
    onSerialOutput,
    onError,
    onSupportedBoards
  };
};

export default DaemonCromeApp;
