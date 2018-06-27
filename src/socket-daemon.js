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
import {
  Subject,
  BehaviorSubject,
  interval
} from 'rxjs';
import { parseMessage, initSocket, initPluginUrl } from './readMessages';
import { debug } from 'util';
// Required agent version
const MIN_VERSION = '1.1.71';

const PROTOCOL = {
  HTTP: 'http',
  HTTPS: 'https'
};

const LOOPBACK_ADDRESS = '127.0.0.1';
const LOOPBACK_HOSTNAME = 'localhost';
const LOOKUP_PORT_START = 8991;
const LOOKUP_PORT_END = 9000;

const CANT_FIND_AGENT_MESSAGE = 'Arduino Create Agent cannot be found';

export const AGENT_STATUS_FOUND = 'AGENT_FOUND';
export const AGENT_STATUS_NOT_FOUND = 'AGENT_NOT_FOUND';
export const WS_STATUS_CONNECTED = 'WS_CONNECTED';
export const WS_STATUS_DISCONNECTED = 'WS_DISCONNECTED';

export default class SocketDaemon {
  constructor() {
    this.selectedProtocol = PROTOCOL.HTTP;
    this.agentInfo = {};
    this.found = false;

    this.agentDiscoveryStatus = new BehaviorSubject(AGENT_STATUS_NOT_FOUND);
    this.wsConnectionStatus = new BehaviorSubject(WS_STATUS_DISCONNECTED);
    this.wsError = new Subject();
  }

  /**
   * Look for the agent endpoint.
   * First search in http://LOOPBACK_ADDRESS, after in https://LOOPBACK_HOSTNAME.
   * @return {object} The found agent info values.
   */
  findAgent() {
    const find = () => {
      return this.tryAllPorts()
        .catch(err => {
          this.agentDiscoveryStatus.next(AGENT_STATUS_NOT_FOUND);
          return err;
        })
        .finally(() => {
          if (!this.isConnected()) {
            setTimeout(find, 3000);
          }
        });
    };
    return find();
  }

  tryAllPorts() {
    return this.tryPorts(LOOPBACK_ADDRESS)
      .catch(() => this.tryPorts(LOOPBACK_HOSTNAME)
        .catch(err => Promise.reject(err)));
  }

  /**
   * Try ports for the selected hostname. From LOOKUP_PORT_START to LOOKUP_PORT_END
   * @param {string} hostname - The hostname value (LOOPBACK_ADDRESS or LOOPBACK_HOSTNAME).
   * @return {object} info - The agent info values.
   */
  tryPorts(hostname) {
    console.log('tryPorts\n');
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
        this.found = responses.some(r => {
          if (r && r.response && r.response.status === 200) {
            this.agentInfo = r.data;
            this.agentDiscoveryStatus.next(AGENT_STATUS_FOUND);
            this.wsConnect();
            if (r.response.url.indexOf(PROTOCOL.HTTPS) === 0) {
              this.selectedProtocol = PROTOCOL.HTTPS;
            }
            initPluginUrl(this.agentInfo[this.selectedProtocol]);
            return true;
          }
          return false;
        });

        if (this.found) {
          return this.update();
        }
        return Promise.reject(new Error(`${CANT_FIND_AGENT_MESSAGE} at ${hostname}`));
      });
  }

  /**
   * Uses the websocket protocol to connect to the agent
   *
   * @return {Promise}
   */
  wsConnect() {
    if (this.socket) {
      return;
    }

    const wsProtocol = this.selectedProtocol === PROTOCOL.HTTPS ? 'ws' : 'wss';
    const address = this.agentInfo[wsProtocol];
    this.socket = io(address);

    this.socket.on('connect', () => {

      initSocket(this.socket);

      // On connect download windows drivers which are indispensable for detection of boards
      this.socket.emit('command', 'downloadtool windows-drivers latest arduino keep');
      this.socket.emit('command', 'downloadtool bossac 1.7.0 arduino keep');

      this.wsConnectionStatus.next(WS_STATUS_CONNECTED);

      // Periodically asks for the ports
      if (!this.portsPollingSubscription) {
        this.portsPollingSubscription = interval(1500).subscribe(() => this.socket.emit('command', 'list'));
      }
    });

    this.socket.on('error', error => this.wsError.next(error));

    // Reconnect on disconnect
    this.socket.on('disconnect', () => {
      if (this.portsPollingSubscription) {
        this.portsPollingSubscription.unsubscribe();
      }
      this.wsConnectionStatus.next(WS_STATUS_DISCONNECTED);
      this.findAgent();
    });

    // Parse messages
    this.socket.on('message', parseMessage);
  }

  /**
   * Check the agent version and call the update if needed.
   */
  update() {
    return new Promise((resolve, reject) => {
      if (this.agentInfo.version && (semVerCompare(this.agentInfo.version, MIN_VERSION) >= 0 || this.agentInfo.version.indexOf('dev') !== -1)) {
        return resolve(this.agentInfo);
      }

      return fetch(`${this.agentInfo[this.selectedProtocol]}/update`, {
        method: 'POST'
      }).then(() => reject()); // We reject the promise because the daemon will be restarted, we need to continue looking for the port
    });
  }

  /**
   * Uploads the sketch and performs action in order to configure the board for Arduino Cloud
   * @param {Object} compiledSketch the Object containing the provisioning sketch, ready to be compiled
   * @param {Object} board contains the board data
   * @param {function} createDeviceCb used to create the device associated to the user
   */
  configureBoard(compiledSketch, board, createDeviceCb) {
    if (!this.isConnected()) {
      return Promise.reject(new Error('We were not able to generate the CSR.'));
    }
    return this.configure(compiledSketch, board, createDeviceCb);
  }

  /**
   * Check if socket connected.
   * @return {boolean} The connection status flag.
   */
  isConnected() {
    return this.socket && this.socket.connected;
  }

  /**
   * Pauses the plugin
   * @return {Promise}
   */
  stopPlugin() {
    if (this.found) {
      return fetch(`${this.agentInfo[this.selectedProtocol]}/pause`, { method: 'POST' });
    }
  }
}
