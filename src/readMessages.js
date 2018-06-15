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

const callbacks = {
  ports: [],
  program: [],
  serial: [],
  download: []
};
const promises = {};
let uploading = false;

let networkPorts = [];
let serialPorts = [];

let socket = null;
let pluginURL = null;

// Sends the data to all the registered callbacks
const callback = (name, data) => {
  if (!callbacks || !callbacks[name] || !callbacks[name].length) {
    return;
  }

  callbacks[name].forEach(cb => {
    cb(data);
  });
};

const parseMessageList = (data) => {
  if (data.Network) {
    networkPorts = data.Ports;
  }
  else {
    serialPorts = data.Ports;
  }
  callback('ports', serialPorts.concat(networkPorts));
};

const parseMessageCommand = (data) => {
  if (data.Cmd === 'Open') {
    if (promises.open) {
      promises.open.resolve(true);
    }
  }
  else if (data.Cmd === 'OpenFail') {
    if (promises.open) {
      promises.open.reject(data.Desc);
    }
  }
  else if (data.Cmd === 'Close') {
    if (promises.close) {
      promises.close.resolve(true);
      promises.close = null;
    }
  }
  else if (data.Cmd === 'CloseFail') {
    if (promises.close) {
      promises.close.reject(data.Desc);
      promises.close = null;
    }
  }
};

const parseFlash = (data) => {
  if (!uploading) {
    return;
  }
  uploading = false;
  callback('program', { done: true, msg: `${data.Flash}\n` });
};

const parseProgram = (data) => {
  if (!uploading) {
    return;
  }
  if (data.ProgrammerStatus === 'Starting') {
    callback('program', { done: false, msg: `Programming with: ${data.Cmd}\n` });
  }
  else if (data.ProgrammerStatus === 'Busy') {
    callback('program', { done: false, msg: `${data.Msg}\n` });
  }
  else if (data.ProgrammerStatus === 'Error') {
    uploading = false;
    callback('program', { done: true, err: `${data.Msg}\n` });
  }
  else if (data.ProgrammerStatus === 'Killed') {
    uploading = false;
    callback('program', { done: false, msg: `terminated by user\n` });
    callback('program', { done: true, msg: `terminated by user\n` });
  }
  else if (data.ProgrammerStatus === 'Error 404 Not Found') {
    uploading = false;
    callback('program', { done: true, err: `${data.Msg}\n` });
  }
};

const parseDownload = (data) => {
  if (data.DownloadStatus === 'Pending') {
    callback('download', data.Msg);
  }
  else if (data.DownloadStatus === 'Success') {
    if (promises.download) {
      promises.download.resolve(data.Msg);
    }
  }
  else if (promises.download) {
    promises.download.reject(data.Msg);
  }
};

const parseMessage = message => {
  let jsonMessage;

  try {
    jsonMessage = JSON.parse(message);
  }
  catch (SyntaxError) {
    return;
  }

  // Result of a list command
  if (jsonMessage && jsonMessage.Ports) {
    return parseMessageList(jsonMessage);
  }

  // Result of a Open or Close command
  if (jsonMessage && jsonMessage.Cmd) {
    return parseMessageCommand(jsonMessage);
  }

  if (jsonMessage && jsonMessage.Error) {
    if (jsonMessage.Error.indexOf('could not find') !== -1) {
      if (promises.close) {
        promises.close.reject(jsonMessage.Error);
        promises.close = null;
      }
    }
    return;
  }

  // Result of a Program command
  if (jsonMessage && jsonMessage.Flash) {
    return parseFlash(jsonMessage);
  }

  if (jsonMessage.Err) {
    return callback('program', { done: false, err: `${jsonMessage.Err}\n` });
  }

  if (jsonMessage && jsonMessage.ProgrammerStatus) {
    return parseProgram(jsonMessage);
  }

  // Result of a download command
  if (jsonMessage && jsonMessage.DownloadStatus) {
    return parseDownload(jsonMessage);
  }

  // Data read from the serial
  if (jsonMessage.D) {
    return callback('serial', { data: jsonMessage.D });
  }
};

// Stolen from https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
function Deferred() {
  /* A method to resolve the associated Promise with the value passed.
    * If the promise is already settled it does nothing.
    *
    * @param {anything} value : This value is used to resolve the promise
    * If the value is a Promise then the associated promise assumes the state
    * of Promise passed as value.
    */
  this.resolve = null;

  /* A method to reject the assocaited Promise with the value passed.
    * If the promise is already settled it does nothing.
    *
    * @param {anything} reason: The reason for the rejection of the Promise.
    * Generally its an Error object. If however a Promise is passed, then the Promise
    * itself will be the reason for rejection no matter the state of the Promise.
    */
  this.reject = null;

  /* A newly created Promise object.
    * Initially in pending state.
    */
  this.promise = new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

}

const perform = (action, data, cb) => {

  const deferred = new Deferred();
  const replacementStrategy = 'keep';

  if (!socket) {
    deferred.reject();
    return deferred.promise;
  }

  if (uploading && action !== 'req_downloadtool') {
    deferred.reject(false);
    return deferred.promise;
  }

  if (action === 'req_serial_monitor_open') {
    socket.emit('command', `open ${data.com_name} ${data.baudrate} timed`, () => {
      promises.open = deferred;
    });
  }
  else if (action === 'req_serial_monitor_write') {
    socket.emit('command', `send ${data.com_name} ${data.data}`, () => {
      deferred.resolve(true);
    });
  }
  else if (action === 'req_serial_monitor_close') {
    socket.emit('command', `close ${data.com_name}`, () => {
      if (promises.close) {
        return promises.close;
      }
      promises.close = deferred;
    });
  }
  else if (action === 'req_downloadtool') {
    if (cb) {
      callbacks.download = [cb];
    }
    if (data.tool) {
      socket.emit('command', `downloadtool ${data.tool} ${data.tool_version} ${data.package} ${replacementStrategy}`, () => {
        promises.download = deferred;
      });
    }
    else {
      deferred.resolve('no need to download a nonexistent tool');
      promises.download = null;
    }
  }
  return deferred.promise;
};

const initSocket = (socketInstance) => {
  socket = socketInstance;
};

const addPortsCallback = (portsCb) => {
  if (typeof portsCb === 'function') {
    callbacks.ports.push(portsCb);
  }
};

const addSerialCallback = (serialCb) => {
  if (typeof serialCb === 'function') {
    callbacks.serial.push(serialCb);
  }
};

const initPluginUrl = (selectedPluginUrl) => {
  pluginURL = selectedPluginUrl;
};

/**
 * Perform an upload via http on the daemon
 * file = {name: 'filename', data: 'base64data'}
 * target = {
 *       board: "name of the board",
 *       port: "port of the board",
 *       auth_user: "Optional user to use as authentication",
 *       auth_pass: "Optional pass to use as authentication"
 *       auth_key: "Optional private key",
 *       auth_port: "Optional alternative port (default 22)"
 *       network: true or false
 *    }
 *    data = {
 *       commandline: "commandline to execute",
 *       signature: "signature of the commandline",
 *       files: [
 *          {name: "Name of a file to upload on the device", data: 'base64data'}
 *       ],
 *       options: {}
 *    }
 *    cb = callback function executing everytime a packet of data arrives through the websocket
 */
const upload = (target, data, cb) => {
  uploading = true;
  callbacks.program = [cb];

  // At least one file to upload
  if (data.files.length === 0) {
    uploading = false;
    callback('program', { done: true, err: 'You need at least one file to upload' });
    return;
  }

  // Main file
  const file = data.files[0];
  file.name = file.name.split('/');
  file.name = file.name[file.name.length - 1];

  const payload = {
    board: target.board,
    port: target.port,
    commandline: data.commandline,
    signature: data.signature,
    hex: file.data,
    filename: file.name,
    extra: {
      auth: {
        username: target.auth_user,
        password: target.auth_pass,
        private_key: target.auth_key,
        port: target.auth_port
      },
      wait_for_upload_port: data.options.wait_for_upload_port === 'true' || data.options.wait_for_upload_port === true,
      use_1200bps_touch: data.options.use_1200bps_touch === 'true' || data.options.use_1200bps_touch === true,
      network: target.network,
      ssh: target.ssh,
      params_verbose: data.options.param_verbose,
      params_quiet: data.options.param_quiet,
      verbose: data.options.verbose
    },
    extrafiles: data.extrafiles || []
  };

  for (let i = 1; i < data.files.length; i += 1) {
    payload.extrafiles.push({ filename: data.files[i].name, hex: data.files[i].data });
  }

  return fetch(`${pluginURL}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    },
    body: JSON.stringify(payload)
  })
    .catch(error => {
      callback('program', { done: true, err: error });
    });
};

const stopUpload = () => {
  uploading = false;
  socket.emit('command', 'killprogrammer');
};

export {
  parseMessage,
  perform,
  addPortsCallback,
  addSerialCallback,
  initSocket,
  initPluginUrl,
  upload,
  stopUpload,
  Deferred
};
