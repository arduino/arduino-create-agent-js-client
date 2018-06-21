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

import { provisioningSketch } from './sketches/provisioning.ino';
import SocketDaemon from './socketDaemon';

/**
 * Returns the correct Provisioning sketch after adding fqbn
 * @param {string} fqbn
 * @return {Object} the Object containing the provisioning sketch, ready to be compiled
 */
const getProvisioningSketch = (fqbn) => {
  provisioningSketch.fqbn = fqbn;
  provisioningSketch.sketch.ino.data = window.btoa(window.unescape(encodeURIComponent(provisioningSketch.sketch.ino.content)));
  return provisioningSketch;
};

const getCsr = (board) => {
  let partialCsr = '';
  let gettingCsr = new Promise((resolve, reject) => {
    if (!SocketDaemon.isConnected()) {
      return reject(new Error('We were not able to generate the CSR.'));
    }

    const parseCsrQuestions = message => {
      // TODO: store partial messages

      if (message.indexOf('No ECCX08 present') !== -1) {
        return reject(new Error('We couldn\'t find the Crypto Chip'));
      }
      if (message.indexOf('Locking ECCX08 configuration failed!') !== -1 || message.indexOf('Writing ECCX08 configuration failed') !== -1) {
        return reject(new Error('already configured'));
      }
      if (message.indexOf('Error generating CSR!') !== -1) {
        return reject(new Error('We were not able to generate the CSR.'));
      }
      if (message.indexOf('Error') !== -1) {
        return reject(new Error(message));
      }
      if (message.indexOf('Would you like to generate a new private key and CSR (y/N):') !== -1) {
        const serialData = {
          com_name: board.port,
          data: 'y\n'
        };
        SocketDaemon.perform('req_serial_monitor_write', serialData);
      }
      if (message.indexOf('Your ECCX08 is unlocked, would you like to lock it (y/N):') !== -1) {
        const serialData = {
          com_name: board.port,
          data: 'y\n'
        };
        SocketDaemon.perform('req_serial_monitor_write', serialData);
      }
      partialCsr += message;
      const begin = partialCsr.indexOf('-----BEGIN CERTIFICATE REQUEST-----');
      const end = partialCsr.indexOf('-----END CERTIFICATE REQUEST-----');
      if (begin !== -1 && end !== -1) {
        const csr = partialCsr.slice(begin, end + 33); // Add 33 to end to include '-----END CERTIFICATE REQUEST-----'
        return resolve(csr);
      }
    };

    SocketDaemon.onSerialOutput(parseCsrQuestions);
  })
    .finally(() => {
      gettingCsr = false;
    });
  return gettingCsr;
};

const storeCertificate = (compressedCert, board) => {
  const storing = new Promise((resolve, reject) => {
    if (!SocketDaemon.isConnected()) {
      return reject(new Error('We were not able to store the certificate on your board'));
    }

    const parseCsr = (message) => {
      if (message.indexOf('Compressed cert') !== -1) {
        return resolve();
      }
      if (message.indexOf('Error') !== -1) {
        return reject(new Error(message));
      }
    };
    SocketDaemon.onSerialOutput(parseCsr);
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
    SocketDaemon.perform('req_serial_monitor_write', serialData);
  });

  return storing;
};

/**
 * Uploads the sketch and performs action in order to configure the board for Arduino Cloud
 * @param {Object} compiledSketch the Object containing the provisioning sketch, ready to be compiled
 * @param {Object} board contains the board data
 * @param {function} createDeviceCb used to create the device associated to the user
 */
const configure = (compiledSketch, board, createDeviceCb) => {
  const serialData = {
    com_name: board.port,
    baudrate: 9600
  };

  SocketDaemon.upload(board, compiledSketch)
    .then(() => SocketDaemon.perform('req_serial_monitor_open', serialData))
    .then(() => getCsr(board))
    .then(csr => createDeviceCb(board.customName, board.id, csr))
    .then(data => storeCertificate(data.compressed))
    .catch(reason => new Error(`Couldn't configure board: ${reason}`))
    .finally(() => SocketDaemon.perform('req_serial_monitor_close', serialData));
};

export {
  getProvisioningSketch,
  configure
};
