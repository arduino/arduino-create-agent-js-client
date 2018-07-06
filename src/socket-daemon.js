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

import io from 'socket.io-client';
import semVerCompare from 'semver-compare';
import { detect } from 'detect-browser';

import { timer } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

import Daemon from './daemon';

// Required agent version
const MIN_VERSION = '1.1.71';
const browser = detect();
const POLLING_INTERVAL = 2500;

const PROTOCOL = {
  HTTP: 'http',
  HTTPS: 'https'
};

const LOOPBACK_ADDRESS = '127.0.0.1';
const LOOPBACK_HOSTNAME = 'localhost';
const LOOKUP_PORT_START = 8991;
const LOOKUP_PORT_END = 9000;
const CANT_FIND_AGENT_MESSAGE = 'Arduino Create Agent cannot be found';
let updateAttempts = 0;
let orderedPluginAddresses = [LOOPBACK_ADDRESS, LOOPBACK_HOSTNAME];

const UPLOAD_DONE = 'UPLOAD_DONE';
const UPLOAD_ERROR = 'UPLOAD_ERROR';
const UPLOAD_IN_PROGRESS = 'UPLOAD_IN_PROGRESS';

if (browser.name !== 'chrome' && browser.name !== 'firefox') {
  orderedPluginAddresses = [LOOPBACK_HOSTNAME, LOOPBACK_ADDRESS];
}

export default class SocketDaemon extends Daemon {
  constructor() {
    super();
    this.selectedProtocol = PROTOCOL.HTTP;
    this.socket = null;
    this.pluginURL = null;

    this.openChannel(() => this.socket.emit('command', 'list'));

    this.agentFound
      .subscribe(agentFound => {
        if (agentFound) {
          this._wsConnect();
        }
        else {
          this.findAgent();
        }
      });
  }

  initSocket() {
    this.socket.on('message', message => {
      try {
        this.appMessages.next(JSON.parse(message));
      }
      catch (SyntaxError) {
        this.appMessages.next(message);
      }
    });
  }

  /**
   * Look for the agent endpoint.
   * First search in http://LOOPBACK_ADDRESS, after in https://LOOPBACK_HOSTNAME if in Chrome or Firefox, otherwise vice versa.
   */
  findAgent() {
    this._tryPorts(orderedPluginAddresses[0])
      .catch(() => this._tryPorts(orderedPluginAddresses[1]))
      .then(() => this.agentFound.next(true))
      .catch(() => timer(POLLING_INTERVAL).subscribe(this.findAgent.bind(this)));
  }

  /**
   * Try ports for the selected hostname. From LOOKUP_PORT_START to LOOKUP_PORT_END
   * @param {string} hostname - The hostname value (LOOPBACK_ADDRESS or LOOPBACK_HOSTNAME).
   * @return {Promise} info - A promise resolving with the agent info values.
   */
  _tryPorts(hostname) {
    const pluginLookups = [];

    for (let port = LOOKUP_PORT_START; port < LOOKUP_PORT_END; port += 1) {
      pluginLookups.push(fetch(`${this.selectedProtocol}://${hostname}:${port}/info`)
        .then(response => response.json().then(data => ({ response, data })))
        .catch(() => Promise.resolve(false)));
      // We expect most of those call to fail, because there's only one agent
      // So we have to resolve them with a false value to let the Promise.all catch all the deferred data
    }

    return Promise.all(pluginLookups)
      .then(responses => {
        const found = responses.some(r => {
          if (r && r.response && r.response.status === 200) {
            this.agentInfo = r.data;
            if (r.response.url.indexOf(PROTOCOL.HTTPS) === 0) {
              this.selectedProtocol = PROTOCOL.HTTPS;
            }
            else {
              // Protocol http, force 127.0.0.1 for old agent versions too
              this.agentInfo[this.selectedProtocol] = this.agentInfo[this.selectedProtocol].replace('localhost', '127.0.0.1');
            }
            this.pluginURL = this.agentInfo[this.selectedProtocol];
            return true;
          }
          return false;
        });

        if (found) {
          if (this.agentInfo.version && (semVerCompare(this.agentInfo.version, MIN_VERSION) >= 0 || this.agentInfo.version.indexOf('dev') !== -1)) {
            return this.agentInfo;
          }
          if (updateAttempts === 0) {
            updateAttempts += 1;
            return this.update();
          }
          if (updateAttempts < 10) {
            return timer(10000).subscribe(this.update().bind(this));
          }
        }
        return Promise.reject(new Error(`${CANT_FIND_AGENT_MESSAGE} at ${hostname}`));
      });
  }

  /**
   * Uses the websocket protocol to connect to the agent
   */
  _wsConnect() {
    const wsProtocol = this.selectedProtocol === PROTOCOL.HTTPS ? 'ws' : 'wss';
    const address = this.agentInfo[wsProtocol];
    this.socket = io(address, { reconnection: false, forceNew: true });

    this.socket.on('connect', () => {
      // On connect download windows drivers which are indispensable for detection of boards
      this.socket.emit('command', 'downloadtool windows-drivers latest arduino keep');
      this.socket.emit('command', 'downloadtool bossac 1.7.0 arduino keep');

      this.initSocket();
      this.channelOpen.next(true);
    });

    this.socket.on('error', error => this.error.next(error));

    this.socket.on('disconnect', () => {
      this.channelOpen.next(false);
    });
  }

  handleAppMessage(message) {
    // Result of a list command
    if (message.Ports) {
      this.handleListMessage(message);
    }
    // Serial monitor message
    if (message.D) {
      this.serialMonitorMessages.next(message.D);
    }

    if (message.ProgrammerStatus) {
      this.handleUploadMessage(message);
    }

    if (message.Err) {
      this.uploading.next({ status: UPLOAD_ERROR, err: message.Err });
    }
  }

  handleListMessage(message) {
    const lastDevices = this.devicesList.getValue();
    if (message.Network && !Daemon.devicesListAreEquals(lastDevices.network, message.Ports)) {
      this.devicesList.next({
        serial: lastDevices.serial,
        network: message.Ports
      });
    }
    else if (!message.Network && !Daemon.devicesListAreEquals(lastDevices.serial, message.Ports)) {
      this.devicesList.next({
        serial: message.Ports,
        network: lastDevices.network
      });
    }
  }

  /**
   * Check the agent version and call the update if needed.
   */
  update() {
    return fetch(`${this.agentInfo[this.selectedProtocol]}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    }).then(() => Promise.reject()); // We reject the promise because the daemon will be restarted, we need to continue looking for the port
  }

  /**
   * Uploads the sketch and performs action in order to configure the board for Arduino Cloud
   * @param {Object} compiledSketch the Object containing the provisioning sketch, already compiled
   * @param {Object} board contains the board data
   * @param {function} createDeviceCb used to create the device associated to the user
   */
  configureBoard(compiledSketch, board, createDeviceCb) {
    if (!this.wsConnect.getValue()) {
      return Promise.reject(new Error('We were not able to generate the CSR.'));
    }
    return this.configure(compiledSketch, board, createDeviceCb);
  }

  /**
   * Pauses the plugin
   * @return {Promise}
   */
  stopPlugin() {
    if (this.agentFound.getValue()) {
      return fetch(`${this.agentInfo[this.selectedProtocol]}/pause`, { method: 'POST' });
    }
  }

  /**
   * Send 'close' command to all the available serial ports
   */
  closeAllPorts() {
    const devices = this.devicesList.getValue().serial;
    devices.forEach(device => {
      this.closeSerialMonitor(device.Name);
    });
  }

  /**
   * Send 'message' to serial port
   * @param {string} port the port name
   * @param {string} message the text to be sent to serial
   */
  writeSerial(port, message) {
    this.socket.emit('command', `send ${port} ${message}`);
  }

  /**
   * Request serial port open
   * @param {string} port the port name
   */
  openSerialMonitor(port, baudrate) {
    if (this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorOpened.error(new Error(`Can't find port ${port}`));
    }
    this.appMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => open))))
      .subscribe(message => {
        if (message.Cmd === 'Open') {
          this.serialMonitorOpened.next(true);
        }
        if (message.Cmd === 'OpenFail') {
          this.serialMonitorOpened.error(new Error(`Failed to open serial ${port}`));
        }
      });
    this.socket.emit('command', `open ${port} ${baudrate} timed`);
  }

  /**
   * Request serial port close
   * @param {string} port the port name
   */
  closeSerialMonitor(port) {
    if (!this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorOpened.error(new Error(`Can't find port ${port}`));
    }
    this.appMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => !open))))
      .subscribe(message => {
        if (message.Cmd === 'Close') {
          this.serialMonitorOpened.next(false);
        }
        if (message.Cmd === 'CloseFail') {
          this.serialMonitorOpened.error(new Error(`Failed to close serial ${port}`));
        }
      });
    this.socket.emit('command', `close ${port}`);
  }

  handleUploadMessage(message) {
    if (this.uploading.getValue().status !== UPLOAD_IN_PROGRESS) {
      return;
    }
    if (message.Flash === 'Ok' && message.ProgrammerStatus === 'Done') {
      this.uploading.next({ status: UPLOAD_DONE, msg: message.Flash });
      return;
    }
    switch (message.ProgrammerStatus) {
      case 'Starting':
        this.uploading.next({ status: UPLOAD_IN_PROGRESS, msg: `Programming with: ${message.Cmd}` });
        break;
      case 'Busy':
        this.uploading.next({ status: UPLOAD_IN_PROGRESS, msg: message.Msg });
        break;
      case 'Error':
        this.uploading.next({ status: UPLOAD_ERROR, err: message.Msg });
        break;
      case 'Killed':
        this.uploading.next({ status: UPLOAD_IN_PROGRESS, msg: `terminated by user` });
        this.uploading.next({ status: UPLOAD_ERROR, err: `terminated by user` });
        break;
      case 'Error 404 Not Found':
        this.uploading.next({ status: UPLOAD_ERROR, err: message.Msg });
        break;
      default:
        this.uploading.next({ status: UPLOAD_IN_PROGRESS, msg: message.Msg });
    }
  }

  /**
   * Perform an upload via http on the daemon
   * @param {Object} target = {
   *   board: "name of the board",
   *   port: "port of the board",
   *   auth_user: "Optional user to use as authentication",
   *   auth_pass: "Optional pass to use as authentication"
   *   auth_key: "Optional private key",
   *   auth_port: "Optional alternative port (default 22)"
   *   network: true or false
   * }
   * @param {Object} data = {
   *  commandline: "commandline to execute",
      signature: "signature of the commandline",
   *  files: [
   *   {name: "Name of a file to upload on the device", data: 'base64data'}
   *  ],
   *  options: {}
   * }
   */
  upload(target, data) {
    this.uploading.next({ status: UPLOAD_IN_PROGRESS });

    if (data.files.length === 0) { // At least one file to upload
      this.uploading.next({ status: UPLOAD_ERROR, err: 'You need at least one file to upload' });
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

    fetch(`${this.pluginURL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: JSON.stringify(payload)
    })
      .catch(error => {
        this.uploading.next({ status: UPLOAD_ERROR, err: error });
      });
  }

  /**
   * Download tool
   * @param {string} toolName
   * @param {string} toolVersion
   * @param {string} packageName
   * @param {string} replacementStrategy
   */
  downloadToolCommand(toolName, toolVersion, packageName, replacementStrategy) {
    this.socket.emit('command', `downloadtool ${toolName} ${toolVersion} ${packageName} ${replacementStrategy}`);
  }

  /**
   * Interrupt upload
   */
  stopUploadCommand() {
    this.uploading.next(false);
    this.socket.emit('command', 'killprogrammer');
  }
}
