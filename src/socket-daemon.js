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

import {
  Subject,
  BehaviorSubject,
  interval,
  timer
} from 'rxjs';
import { filter, startWith, takeUntil } from 'rxjs/operators';
import Daemon from './daemon';

// Required agent version
const MIN_VERSION = '1.1.71';
const browser = detect();

const PROTOCOL = {
  HTTP: 'http',
  HTTPS: 'https'
};

const LOOPBACK_ADDRESS = '127.0.0.1';
const LOOPBACK_HOSTNAME = 'localhost';
const LOOKUP_PORT_START = 8991;
const LOOKUP_PORT_END = 9000;
const POLLING_INTERVAL = 1000;
const CANT_FIND_AGENT_MESSAGE = 'Arduino Create Agent cannot be found';
let updateAttempts = 0;
let orderedPluginAddresses = [LOOPBACK_ADDRESS, LOOPBACK_HOSTNAME];

if (browser.name !== 'chrome' && browser.name !== 'firefox') {
  orderedPluginAddresses = [LOOPBACK_HOSTNAME, LOOPBACK_ADDRESS];
}

export default class SocketDaemon extends Daemon {
  constructor() {
    super();
    this.selectedProtocol = PROTOCOL.HTTP;
    this.agentInfo = {};
    this.agentFound = new BehaviorSubject(null);
    this.wsConnected = new BehaviorSubject(null);
    this.error = new Subject();

    this.wsConnected
      .subscribe(wsConnected => {
        if (wsConnected) {
          this.initSocket();
          interval(POLLING_INTERVAL)
            .pipe(startWith(0))
            .pipe(takeUntil(this.wsConnected.pipe(filter(status => !status))))
            .subscribe(() => this.socket.emit('command', 'list'));
        }
        else {
          this.agentFound.next(false);
        }
      });

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
            this.initPluginUrl(this.agentInfo[this.selectedProtocol]);
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

      this.wsConnected.next(true);
    });

    this.socket.on('error', error => this.error.next(error));

    this.socket.on('disconnect', () => {
      this.wsConnected.next(false);
    });
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
   * @param {Object} compiledSketch the Object containing the provisioning sketch, ready to be compiled
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
}
