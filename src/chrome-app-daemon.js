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
import { takeUntil, filter } from 'rxjs/operators';

import Daemon from './daemon';

const UPLOAD_DONE = 'UPLOAD_DONE';
const UPLOAD_ERROR = 'UPLOAD_ERROR';
const UPLOAD_IN_PROGRESS = 'UPLOAD_IN_PROGRESS';

export default class ChromeOsDaemon extends Daemon {
  constructor(chromeExtensionId) {
    super();
    this.channel = null;

    this.openChannel(() => this.channel.postMessage({
      command: 'listPorts'
    }));

    this._appConnect(chromeExtensionId);
  }

  /**
   * Instantiate connection and events listeners for chrome app
   */
  _appConnect(chromeExtensionId) {
    if (chrome.runtime) {
      this.channel = chrome.runtime.connect(chromeExtensionId);
      this.channel.onMessage.addListener(message => {
        if (message.version) {
          this.agentInfo = message;
          this.agentFound.next(true);
          this.channelOpen.next(true);
        }
        else {
          this.appMessages.next(message);
        }
      });
      this.channel.onDisconnect.addListener(() => {
        this.channelOpen.next(false);
        this.agentFound.next(false);
      });
    }
  }

  handleAppMessage(message) {
    if (message.ports) {
      this.handleListMessage(message);
    }

    if (message.supportedBoards) {
      this.supportedBoards.next(message.supportedBoards);
    }

    if (message.serialData) {
      this.serialMonitorMessages.next(message.serialData);
    }

    if (message.programmerstatus) {
      this.handleUploadMessage(message);
    }

    if (message.err) {
      this.uploading.next({ status: UPLOAD_ERROR, err: message.Err });
    }
  }


  handleListMessage(message) {
    const lastDevices = this.devicesList.getValue();
    if (!Daemon.devicesListAreEquals(lastDevices.serial, message.ports)) {
      this.devicesList.next({
        serial: message.ports.map(port => ({
          Name: port.name,
          SerialNumber: port.serialNumber,
          IsOpen: port.isOpen,
          VendorID: port.vendorId,
          ProductID: port.productId
        })),
        network: []
      });
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
        if (message.portOpenStatus === 'success') {
          this.serialMonitorOpened.next(true);
        }
        if (message.portOpenStatus === 'error') {
          this.serialMonitorOpened.error(new Error(`Failed to open serial ${port}`));
        }
      });
    this.channel.postMessage({
      command: 'openPort',
      data: {
        name: port,
        baudrate
      }
    });
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
        if (message.portCloseStatus === 'success') {
          this.serialMonitorOpened.next(false);
        }
        if (message.portCloseStatus === 'error') {
          this.serialMonitorOpened.error(new Error(`Failed to close serial ${port}`));
        }
      });
    this.channel.postMessage({
      command: 'closePort',
      data: {
        name: port
      }
    });
  }

  handleUploadMessage(message) {
    if (this.uploading.getValue().status !== UPLOAD_IN_PROGRESS) {
      return;
    }
    switch (message.uploadStatus) {
      case 'message':
        this.uploading.next({ status: UPLOAD_IN_PROGRESS, msg: message.message });
        break;
      case 'error':
        this.uploading.next({ status: UPLOAD_ERROR, err: message.message });
        break;
      case 'success':
        this.uploading.next({ status: UPLOAD_DONE, msg: message.message });
        break;
      default:
        this.uploading.next({ status: UPLOAD_IN_PROGRESS });
    }
  }

  /**
   * Perform an upload via http on the daemon
   * @param {Object} target = {
   *   board: "name of the board",
   *   port: "port of the board",
   * }
   * @param {Object} data = {
   *  commandline: "commandline to execute",
   *  files: [
   *   {name: "Name of a file to upload on the device", data: 'base64data'}
   *  ],
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
      filename: file.name,
      data: file.data,
    };

    try {
      window.oauth.token().then(token => {
        payload.token = token.token;
        this.channel.postMessage({
          command: 'upload',
          data: payload
        });
      });
    }
    catch (err) {
      this.uploading.next({ status: UPLOAD_ERROR, err: 'you need to be logged in on a Create site to upload by Chrome App' });
    }
  }
}
