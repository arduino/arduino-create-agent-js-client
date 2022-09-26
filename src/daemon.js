/*
* Copyright 2018 ARDUINO SA (http://www.arduino.cc/)
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
  Subject, BehaviorSubject, interval, timer
} from 'rxjs';
import {
  takeUntil, filter, startWith, first, distinctUntilChanged
} from 'rxjs/operators';

const POLLING_INTERVAL = 1500;

export default class Daemon {
  constructor(boardsUrl = 'https://builder.arduino.cc/v3/boards') {
    this.BOARDS_URL = boardsUrl;
    this.UPLOAD_NOPE = 'UPLOAD_NOPE';
    this.UPLOAD_DONE = 'UPLOAD_DONE';
    this.UPLOAD_ERROR = 'UPLOAD_ERROR';
    this.UPLOAD_IN_PROGRESS = 'UPLOAD_IN_PROGRESS';

    this.DOWNLOAD_DONE = 'DOWNLOAD_DONE';
    this.DOWNLOAD_NOPE = 'DOWNLOAD_NOPE';
    this.DOWNLOAD_ERROR = 'DOWNLOAD_ERROR';
    this.DOWNLOAD_IN_PROGRESS = 'DOWNLOAD_IN_PROGRESS';

    this.agentInfo = {};
    this.agentFound = new BehaviorSubject(null);
    this.channelOpen = new BehaviorSubject(null);
    this.channelOpenStatus = this.channelOpen.pipe(distinctUntilChanged());
    this.error = new BehaviorSubject(null).pipe(distinctUntilChanged());
    this.serialMonitorError = new BehaviorSubject(null);

    this.appMessages = new Subject();
    this.serialMonitorOpened = new BehaviorSubject(false);
    this.serialMonitorMessages = new Subject();
    this.serialMonitorMessagesWithPort = new Subject();
    this.uploading = new BehaviorSubject({ status: this.UPLOAD_NOPE });
    this.uploadingDone = this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_DONE))
      .pipe(first())
      .pipe(takeUntil(this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_ERROR))));
    this.uploadingError = this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_ERROR))
      .pipe(first())
      .pipe(takeUntil(this.uploadingDone));
    this.uploadInProgress = this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_IN_PROGRESS));
    this.devicesList = new BehaviorSubject({
      serial: [],
      network: []
    });
    this.supportedBoards = new BehaviorSubject([]);
    this.appMessages
      .subscribe(message => this.handleAppMessage(message));

    // Close all serial ports on startup
    this.devicesList
      .pipe(filter(devices => devices.serial && devices.serial.length > 0))
      .pipe(first())
      .subscribe(() => this.closeAllPorts());

    this.downloading = new BehaviorSubject({ status: this.DOWNLOAD_NOPE });
    this.downloadingDone = this.downloading.pipe(filter(download => download.status === this.DOWNLOAD_DONE))
      .pipe(first())
      .pipe(takeUntil(this.downloading.pipe(filter(download => download.status === this.DOWNLOAD_ERROR))));
    this.downloadingError = this.downloading.pipe(filter(download => download.status === this.DOWNLOAD_ERROR))
      .pipe(first())
      .pipe(takeUntil(this.downloadingDone));

    this.boardPortAfterUpload = new Subject().pipe(first());
    this.uploadingPort = null;
  }

  notifyUploadError(err) {
    this.uploading.next({ status: this.UPLOAD_ERROR, err });
  }

  openChannel(cb) {
    this.channelOpen
      .subscribe(open => {
        if (open) {
          interval(POLLING_INTERVAL)
            .pipe(startWith(0))
            .pipe(takeUntil(this.channelOpen.pipe(filter(status => !status))))
            .subscribe(cb);
        }
        else {
          this.devicesList.next({
            serial: [],
            network: []
          });
          this.agentFound.next(false);
        }
      });
  }

  /**
   * Upload a sketch to serial target
   * Fetch commandline from boards API for serial upload
   * @param {Object} target
   * @param {string} sketchName
   * @param {Object} compilationResult
   * @param {boolean} verbose
   * @param {any[]} dialogCustomizations Optional - Used in Web Serial API to customize the permission dialogs.
   *        It's an array because the Web Serial API library can use more than one dialog, e.g. one to
   *        ask permission and one to give instruction to save an UF2 file.
   *        It's called 'customizations' because the library already provides a basic non-styled dialog.
   */
  uploadSerial(target, sketchName, compilationResult, verbose = true, dialogCustomizations) {
    this.uploadingPort = target.port;
    this.uploading.next({ status: this.UPLOAD_IN_PROGRESS, msg: 'Upload started' });
    this.serialDevicesBeforeUpload = this.devicesList.getValue().serial;

    this.closeSerialMonitor(target.port);

    // Fetch command line for the board
    fetch(`${this.BOARDS_URL}/${target.board}/compute`, {
      method: 'POST',
      body: JSON.stringify({ action: 'upload', verbose, os: this.agentInfo.os })
    })
      .then(result => result.json())
      .then(uploadCommandInfo => {
        let ext = Daemon._extractExtensionFromCommandline(uploadCommandInfo.commandline);
        const data = compilationResult[ext] || compilationResult.bin;
        if (!ext || !data) {
          console.log('we received a faulty ext property, defaulting to .bin');
          ext = 'bin';
        }

        const uploadPayload = {
          ...target,
          commandline: uploadCommandInfo.commandline,
          filename: `${sketchName}.${ext}`,
          hex: data, // For desktop agent
          data, // For chromeOS plugin, consider to align this
          dialogCustomizations // used only in Web Serial API uploader
        };

        this.uploadingDone.subscribe(() => {
          this.waitingForPortToComeUp = timer(1000).subscribe(() => {
            const currentSerialDevices = this.devicesList.getValue().serial;
            let boardFound = currentSerialDevices.find(device => device.Name === this.uploadingPort);
            if (!boardFound) {
              boardFound = currentSerialDevices.find(d => this.serialDevicesBeforeUpload.every(e => e.Name !== d.Name));
              if (boardFound) {
                this.uploadingPort = boardFound.Name;
                this.boardPortAfterUpload.next({
                  hasChanged: true,
                  newPort: this.uploadingPort
                });
              }
            }

            if (boardFound) {
              this.waitingForPortToComeUp.unsubscribe();
              this.uploadingPort = null;
              this.serialDevicesBeforeUpload = null;
              this.boardPortAfterUpload.next({
                hasChanged: false
              });
            }
          });
        });
        const files = [...(uploadCommandInfo.files || []), ...(compilationResult.files || [])];
        this._upload(uploadPayload, { ...uploadCommandInfo, files });
      });
  }

  /**
   * Compares 2 devices list checking they contains the same ports in the same order
   * @param {Array<device>} a the first list
   * @param {Array<device>} b the second list
   */
  static devicesListAreEquals(a, b) {
    if (!a || !b || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => (b[index].Name === item.Name && b[index].IsOpen === item.IsOpen));
  }

  /**
   * Interrupt upload - not supported in Chrome app
   */
  stopUpload() {
    if (typeof this.stopUploadCommand === 'function') {
      this.stopUploadCommand();
    }
    else {
      throw new Error('Stop Upload not supported on Chrome OS');
    }
  }

  /**
   * Set the board in bootloader mode. This is needed to bo 100% sure to receive the correct vid/pid from the board.
   * To do that we just touch the port at 1200 bps and then close it. The sketch on the board will be erased.
   * @param {String} port the port name
   */
  setBootloaderMode(port) {
    this.serialMonitorOpened.pipe(filter(open => open)).pipe(first()).subscribe(() => {
      timer(1000).subscribe(() => this.closeSerialMonitor(port));
    });
    this.openSerialMonitor(port, 1200);
  }

  static _extractExtensionFromCommandline(commandline) {
    const rx = /\{build\.project_name\}\.(\w\w\w)\b/g;
    const arr = rx.exec(commandline);
    if (arr && arr.length > 0) {
      return arr[1];
    }
    return null;
  }
}
