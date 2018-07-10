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

import { BehaviorSubject } from 'rxjs';
import { takeUntil, filter, first } from 'rxjs/operators';
import { provisioningSketch } from './sketches/provisioning.ino';

const BAUDRATE = 9600;

export default class BoardConfiguration {
  constructor(daemon) {
    this.CONFIGURE_IN_PROGRESS = 'CONFIGURE_IN_PROGRESS';
    this.CONFIGURE_NOPE = 'CONFIGURE_NOPE';
    this.CONFIGURE_DONE = 'CONFIGURE_DONE';
    this.CONFIGURE_ERROR = 'CONFIGURE_ERROR';

    this.daemon = daemon;
    this.serialMonitorContent = '';
    this.configuring = new BehaviorSubject({ status: this.CONFIGURE_NOPE });

    this.daemon.serialMonitorMessages.subscribe(message => {
      this.serialMonitorContent += message;
    });
  }

  /**
   * Returns the correct Provisioning sketch after adding fqbn
   * @param {string} fqbn
   * @return {Object} the Object containing the provisioning sketch, ready to be compiled
   */
  static getProvisioningSketch(fqbn) {
    provisioningSketch.fqbn = fqbn;
    provisioningSketch.sketch.ino.data = window.btoa(window.unescape(encodeURIComponent(provisioningSketch.sketch.ino.content)));
    return provisioningSketch;
  }

  getCsr(board) {
    let partialMessage = '';
    const gettingCsr = new Promise((resolve, reject) => {
      const parseCsrQuestions = message => {
        // TODO: store partial messages
        partialMessage += message;

        if (partialMessage.indexOf('No ECCX08 present') !== -1) {
          return reject(new Error('We couldn\'t find the Crypto Chip'));
        }
        if (partialMessage.indexOf('Locking ECCX08 configuration failed!') !== -1 || partialMessage.indexOf('Writing ECCX08 configuration failed') !== -1) {
          return reject(new Error('already configured'));
        }
        if (partialMessage.indexOf('Error generating CSR!') !== -1) {
          return reject(new Error('We were not able to generate the CSR.'));
        }
        if (partialMessage.indexOf('Error') !== -1) {
          return reject(new Error(message));
        }
        if (partialMessage.indexOf('Would you like to generate a new private key and CSR (y/N):') !== -1) {
          partialMessage = '';
          const serialData = {
            com_name: board.port,
            data: 'y\n'
          };
          this.daemon.writeSerial(board.port, serialData);
        }
        if (partialMessage.indexOf('Your ECCX08 is unlocked, would you like to lock it (y/N):') !== -1) {
          partialMessage = '';
          const serialData = {
            com_name: board.port,
            data: 'y\n'
          };
          this.daemon.writeSerial(board.port, serialData);
        }

        const begin = partialMessage.indexOf('-----BEGIN CERTIFICATE REQUEST-----');
        const end = partialMessage.indexOf('-----END CERTIFICATE REQUEST-----');
        if (begin !== -1 && end !== -1) {
          const csr = partialMessage.slice(begin, end + 33); // Add 33 to end to include '-----END CERTIFICATE REQUEST-----'
          return resolve(csr);
        }
      };

      this.serialMessagesSubscription = this.daemon.serialMonitorMessages.subscribe(parseCsrQuestions);
    });
    return gettingCsr.finally(() => this.serialMessagesSubscription.unsubscribe());
  }

  storeCertificate(compressedCert, board) {
    let partialMessage = '';
    const storing = new Promise((resolve, reject) => {
      const parseCsr = (message) => {
        partialMessage += message;
        if (partialMessage.indexOf('Compressed cert') !== -1) {
          return resolve();
        }
        if (partialMessage.indexOf('Error') !== -1) {
          return reject(new Error(message));
        }
      };
      this.serialMessagesSubscription = this.daemon.serialMonitorMessages.subscribe(parseCsr);

      const notBefore = new Date(compressedCert.not_before);
      const notAfter = new Date(compressedCert.not_after);
      // eslint-disable-next-line prefer-template
      const answers = board.id + '\n' +
                  notBefore.getUTCFullYear() + '\n' +
                  (notBefore.getUTCMonth() + 1) + '\n' +
                  notBefore.getUTCDate() + '\n' +
                  notBefore.getUTCHours() + '\n' +
                  (notAfter.getUTCFullYear() - notBefore.getUTCFullYear()) + '\n' +
                  compressedCert.serial + '\n' +
                  compressedCert.signature + '\n';

      const serialData = {
        com_name: board.port,
        data: answers
      };
      this.daemon.writeSerial(board.port, serialData);
    });

    return storing.finally(() => this.serialMessagesSubscription.unsubscribe());
  }

  /**
   * Uploads the sketch and performs action in order to configure the board for Arduino Cloud
   * @param {Object} compiledSketch the Object containing the provisioning sketch, ready to be compiled
   * @param {Object} board contains the board data
   * @param {function} createDeviceCb used to create the device associated to the user
   */
  configure(compiledSketch, board, createDeviceCb) {
    this.configuring.next({ status: this.CONFIGURE_IN_PROGRESS, msg: 'Starting board configuration' });
    if (!this.daemon.channelOpen.getValue()) {
      const errorMessage = `Couldn't configure board at port ${board.port} because we there is no open channel to the Arduino Create Plugin.`;
      this.configuring.next({
        status: this.CONFIGURE_ERROR,
        msg: errorMessage,
        err: 'cannot find plugin'
      });
      return;
    }
    this.serialMonitorContent = '';

    const uploadTarget = {
      board: board.fqbn,
      port: board.port,
      network: false
    };

    const file = {
      name: compiledSketch.name + board.upload[0].ext,
      data: compiledSketch.hex
    };

    const uploadData = {
      files: [file],
      commandline: board.upload[0].commandline,
      signature: board.upload[0].options.signature,
      extrafiles: [],
      options: {
        wait_for_upload_port: (board.upload[0].options.wait_for_upload_port === true || board.upload[0].options.wait_for_upload_port === 'true'), // eslint-disable-line camelcase
        use_1200bps_touch: (board.upload[0].options.use_1200bps_touch === true || board.upload[0].options.use_1200bps_touch === 'true'), // eslint-disable-line camelcase
        params_verbose: '-v' // eslint-disable-line camelcase
      }
    };

    // check the uploading status:
    if (this.daemon.uploading.getValue().status === this.daemon.UPLOAD_IN_PROGRESS) {
      // if there is an upload in course, notify observers;
      this.configuring.next({
        status: this.CONFIGURE_ERROR,
        msg: `Couldn't configure board at port ${board.port}. There is already an upload in progress.`,
        err: `upload in progress`
      });
      return;
    }

    this.daemon.uploadingDone.pipe(first()).subscribe(() => {
      this.daemon.serialMonitorOpened.pipe(takeUntil(this.daemon.serialMonitorOpened.pipe(filter(open => open))))
        .subscribe(() => {
          this.getCsr(board)
            .then(csr => createDeviceCb(csr))
            .then(data => this.storeCertificate(data.compressed))
            .then(() => this.configuring.next({ status: this.CONFIGURE_DONE }))
            .catch(reason => this.configuring.next({
              status: this.CONFIGURE_ERROR,
              msg: `Couldn't configure board at port ${board.port}. Configuration failed with error: ${reason}`,
              err: reason.toString()
            }))
            .finally(() => this.daemon.closeSerialMonitor(board.port, BAUDRATE));
        }, error => {
          this.configuring.next({
            status: this.CONFIGURE_ERROR,
            msg: `Couldn't configure board at port ${board.port}. Configuration failed with error: ${error}`,
            err: error.toString()
          });
        });
      this.daemon.openSerialMonitor(board.port, BAUDRATE);
    });

    this.daemon.uploadingError.pipe(first()).subscribe(upload => {
      this.configuring.next({ status: this.CONFIGURE_ERROR, err: `Couldn't configure board at port ${board.port}. Upload failed with error: ${upload.err}` });
    });

    this.daemon.upload(uploadTarget, uploadData);
  }
}
