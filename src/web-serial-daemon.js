/*
* Copyright 2022 ARDUINO SA (http://www.arduino.cc/)
* This file is part of arduino-create-agent-js-client.
* Copyright (c) 2018
* Authors: Alberto Iannaccone, Stefania Mellai, Gabriele Destefanis
*
* This software is released under:
* The GNU General Public License, which covers the main part of
* arduino-create-agent-js-client
* The terms of this license can be found at:
* https://www.gnu.org/licenses/gpl-3.0.en.html
*
* You can be released from the requirements of the above licenses by purchasing
* a commercial license. Buying such a license is mandatory if you want to modify or
* otherwise use the software for commercial activities involving the Arduino
* software without disclosing the source code of your own applications. To purchase
* a commercial license, send an email to license@arduino.cc.
*
*/

import {
  distinctUntilChanged, filter, takeUntil
} from 'rxjs/operators';

import Daemon from './daemon';

/**
 * WARNING: the WebSerialDaemon with support for the Web Serial API is still in an alpha version.
 * At the moment it doesn't implement all the features available in the Chrome App Deamon
 * Use at your own risk.
 *
 * The `channel` parameter in the constructor is the component which is
 * used to interact with the Web Serial API.
 *
 * It must provide a `postMessage` method, similarly to the object created with `chrome.runtime.connect` in
 * the `chrome-app-daemon.js` module, which is used to send messages to interact with the Web Serial API.
 */
export default class WebSerialDaemon extends Daemon {
  constructor(boardsUrl, channel) {
    super(boardsUrl);

    this.port = null;
    this.channelOpenStatus.next(true);
    this.channel = channel; // channel is injected from the client app
    this.connectedPorts = [];

    this.init();
  }

  init() {
    this.agentFound
      .pipe(distinctUntilChanged())
      .subscribe(found => {
        if (!found) {
          // Set channelOpen false for the first time
          if (this.channelOpen.getValue() === null) {
            this.channelOpen.next(false);
          }

          this.connectToChannel();
        }
        else {
          this.openChannel(() => this.channel.postMessage({
            command: 'listPorts'
          }));
        }
      });
  }

  connectToChannel() {
    this.channel.onMessage(message => {
      if (message.version) {
        this.agentInfo = {
          version: message.version,
          os: 'ChromeOS'
        };
        this.agentFound.next(true);
        this.channelOpen.next(true);
      }
      else {
        this.appMessages.next(message);
      }
    });
    this.channel.onDisconnect(() => {
      this.channelOpen.next(false);
      this.agentFound.next(false);
    });
  }

  handleAppMessage(message) {
    if (message.ports) {
      this.handleListMessage(message);
    }
    else if (message.supportedBoards) {
      this.supportedBoards.next(message.supportedBoards);
    }
    if (message.serialData) {
      this.serialMonitorMessages.next(message.serialData);
    }

    if (message.uploadStatus) {
      this.handleUploadMessage(message);
    }

    if (message.err) {
      this.uploading.next({ status: this.UPLOAD_ERROR, err: message.Err });
    }
  }

  handleUploadMessage(message) {
    if (this.uploading.getValue().status !== this.UPLOAD_IN_PROGRESS) {
      return;
    }
    switch (message.uploadStatus) {
      case 'message':
        this.uploading.next({
          status: this.UPLOAD_IN_PROGRESS,
          msg: message.message,
          operation: message.operation,
          port: message.port
        });
        break;
      case 'error':
        this.uploading.next({ status: this.UPLOAD_ERROR, err: message.message });
        break;
      case 'success':
        this.uploading.next(
          {
            status: this.UPLOAD_DONE,
            msg: message.message,
            operation: message.operation,
            port: message.port
          }
        );
        break;

      default:
        this.uploading.next({ status: this.UPLOAD_IN_PROGRESS });
    }
  }

  handleListMessage(message) {
    const lastDevices = this.devicesList.getValue();
    if (!Daemon.devicesListAreEquals(lastDevices.serial, message.ports)) {
      this.devicesList.next({
        serial: message.ports
          .map(port => ({
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
    if (Array.isArray(devices)) {
      devices.forEach(device => {
        this.channel.postMessage({
          command: 'closePort',
          data: {
            name: device.Name
          }
        });
      });
    }
  }

  /**
   * Send the 'writePort' message to the serial port
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
      return this.serialMonitorError.next(`Can't find port ${port}`);
    }
    this.appMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => open))))
      .subscribe(message => {
        if (message.portOpenStatus === 'success') {
          this.serialMonitorOpened.next(true);
        }
        if (message.portOpenStatus === 'error') {
          this.serialMonitorError.next(`Failed to open serial ${port}`);
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

  closeSerialMonitor(port) {
    if (!this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorError.next(`Can't find port ${port}`);
    }
    this.appMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => !open))))
      .subscribe(message => {
        if (message.portCloseStatus === 'success') {
          this.serialMonitorOpened.next(false);
        }
        if (message.portCloseStatus === 'error') {
          this.serialMonitorError.next(`Failed to close serial ${port}`);
        }
      });
    this.channel.postMessage({
      command: 'closePort',
      data: {
        name: port
      }
    });
  }

  connectToSerialDevice({ from, dialogCustomization }) {
    this.channel.postMessage({
      command: 'connectToSerial',
      data: {
        from,
        dialogCustomization
      }
    });
  }

  /**
   * @param {object} uploadPayload
   * TODO: document param's shape
   */
  _upload(uploadPayload, uploadCommandInfo) {
    const {
      board, port, commandline, data, pid, vid, filename, dialogCustomizations
    } = uploadPayload;

    const extrafiles = uploadCommandInfo && uploadCommandInfo.files && Array.isArray(uploadCommandInfo.files) ? uploadCommandInfo.files : [];

    try {
      window.oauth.getAccessToken().then(token => {
        this.channel.postMessage({
          command: 'upload',
          data: {
            board,
            port,
            commandline,
            data,
            token: token.token,
            extrafiles,
            pid,
            vid,
            filename,
            dialogCustomizations
          }
        });
      });
    }
    catch (err) {
      this.uploading.next({ status: this.UPLOAD_ERROR, err: 'you need to be logged in on a Create site to upload by Chrome App' });
    }
  }
}
