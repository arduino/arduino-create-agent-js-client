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
import { parseMessage, perform, addPortsCallback, addSerialCallback, initSocket, initPluginUrl, upload, stopUpload } from './readMessages';

// Required agent version
const MIN_VERSION = '1.1.69';

const PROTOCOL = {
  HTTP: 'http',
  HTTPS: 'https'
};

const LOOPBACK_ADDRESS = '127.0.0.1';
const LOOPBACK_HOSTNAME = 'localhost';
const LOOKUP_PORT_START = 8991;
const LOOKUP_PORT_END = 9000;

let selectedProtocol = PROTOCOL.HTTP;
let agentInfo = {};
let found = false;
const tryInterval = 2500;
let pollingId = null;
let socket = null;
let portsPolling = null;

let wsConnectCb = null;
let wsErrorCb = null;
let wsDisconnectCb = null;

const errorMessage = 'Arduino Create Agent cannot be found';

// Stolen from https://github.com/substack/semver-compare
const semVerCompare = (a, b) => {
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < 3; i += 1) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (na > nb) {
      return 1;
    }
    if (nb > na) {
      return -1;
    }
    if (!Number.isNaN(na) && Number.isNaN(nb)) {
      return 1;
    }
    if (Number.isNaN(na) && !Number.isNaN(nb)) {
      return -1;
    }
  }
  return 0;
};

/**
 * Check the agent version and call the update if needed.
 */
const update = () => new Promise(resolve => {
  if (agentInfo.version && (semVerCompare(agentInfo.version, MIN_VERSION) >= 0 || agentInfo.version.indexOf('dev') !== -1)) {
    resolve(agentInfo);
  }

  return fetch(`${agentInfo[selectedProtocol]}/update`, {
    method: 'POST'
  });
});

/**
 * Uses the websocket protocol to connect to the agent
 *
 * @return {Promise}
 */
const wsConnect = () => {
  if (socket) {
    return;
  }

  let wsProtocol = 'ws';

  if (selectedProtocol === PROTOCOL.HTTPS) {
    wsProtocol = 'wss';
  }

  const address = agentInfo[wsProtocol];
  socket = io(address);

  socket.on('connect', () => {

    initSocket(socket);

    // On connect download windows drivers which are indispensable for detection of boards
    socket.emit('command', 'downloadtool windows-drivers latest arduino keep');
    socket.emit('command', 'downloadtool bossac 1.7.0 arduino keep');

    if (typeof wsConnectCb === 'function') {
      wsConnectCb();
    }

    // Periodically asks for the ports
    if (!portsPolling) {
      portsPolling = setInterval(() => {
        socket.emit('command', 'list');
      }, 1500);
    }
  });

  socket.on('error', () => {
    if (typeof wsErrorCb === 'function') {
      wsErrorCb();
    }
  });

  // Reconnect on disconnect
  socket.on('disconnect', () => {
    clearInterval(portsPolling);
    portsPolling = null;
    if (typeof wsDisconnectCb === 'function') {
      wsDisconnectCb();
    }
    wsConnect();
  });

  // Parse messages
  socket.on('message', parseMessage);
};

/**
 * Try ports for the selected hostname. From LOOKUP_PORT_START to LOOKUP_PORT_END
 * @param {string} hostname - The hostname value (LOOPBACK_ADDRESS or LOOPBACK_HOSTNAME).
 * @return {object} info - The agent info values.
 */
const tryPorts = hostname => {
  const pluginLookups = [];

  for (let port = LOOKUP_PORT_START; port < LOOKUP_PORT_END; port += 1) {
    pluginLookups.push(fetch(`${selectedProtocol}://${hostname}:${port}/info`).then(response => {
      return response.json().then(data => {
        return {
          response,
          data
        };
      });
    })
      .catch(() => {
        // We expect most of those call to fail, because there's only one agent
        // So we have to resolve them with a false value to let the Promise.all catch all the deferred data
        Promise.resolve(false);
      }));
  }

  return Promise.all(pluginLookups).then(responses => {
    found = responses.some(r => {
      if (r && r.response && r.response.status === 200) {
        agentInfo = r.data;
        wsConnect();
        if (r.response.url.indexOf(PROTOCOL.HTTPS) === 0) {
          selectedProtocol = PROTOCOL.HTTPS;
        }
        initPluginUrl(agentInfo[selectedProtocol]);
        return true;
      }
      return false;
    });

    if (found) {
      return update()
        .then(() => agentInfo);
    }
    return Promise.reject(new Error(`${errorMessage} at ${hostname}`));
  });
};

const SocketDaemon = (callbacks) => {

  wsConnectCb = callbacks.onConnect;
  wsErrorCb = callbacks.onError;
  wsDisconnectCb = callbacks.onDisconnect;

  addPortsCallback(callbacks.onPortsUpdate);
  addSerialCallback(callbacks.onSerialOutput);

  /**
   * Set onPortUpdate callback.
   */
  const onPortsUpdate = (onPortsUpdateCb) => {
    callbacks.onPortsUpdate = onPortsUpdateCb;
    addPortsCallback(callbacks.onPortsUpdate);
  };

  /**
   * Set onSerialOutput callback.
   */
  const onSerialOutput = (onSerialOutputCb) => {
    callbacks.onSerialOutput = onSerialOutputCb;
    addSerialCallback(callbacks.onSerialOutput);
  };

  /**
   * Set onSocketConnect callback.
   */
  const onConnect = (onSocketConnectCb) => {
    wsConnectCb = onSocketConnectCb;
  };

  /**
   * Set onErrorCb callback.
   */
  const onError = (onErrorCb) => {
    wsErrorCb = onErrorCb;
  };

  /**
   * Set onDisconnect callback.
   */
  const onDisconnect = (onDisconnectCb) => {
    wsDisconnectCb = onDisconnectCb;
  };

  /**
   * Check if socket connected.
   * @return {boolean} The connection status flag.
   */
  const connected = () => socket && socket.connected;

  /**
   * Look for the agent endpoint.
   * First search in http://LOOPBACK_ADDRESS, after in https://LOOPBACK_HOSTNAME.
   * @return {object} The found agent info values.
   */
  const connect = () => {
    if (found) {
      return fetch(agentInfo[selectedProtocol])
        .then(response => response.json())
        .catch(() => {
          found = false;
          return Promise.reject(new Error(errorMessage));
        });
    }

    return tryPorts(LOOPBACK_ADDRESS).catch(() => tryPorts(LOOPBACK_HOSTNAME)
      .catch(() => Promise.reject(new Error(errorMessage))));
  };

  /**
   * Pauses the plugin
   * @return {Promise}
   */
  const stopPlugin = () => {
    if (found) {
      return fetch(`${agentInfo[selectedProtocol]}/pause`);
    }
  };

  return {
    connect,
    perform,
    connected,
    stopPlugin,
    upload,
    stopUpload,
    onDisconnect,
    onConnect,
    onPortsUpdate,
    onSerialOutput,
    onError
  };
};

export default SocketDaemon;
