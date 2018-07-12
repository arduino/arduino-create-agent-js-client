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
