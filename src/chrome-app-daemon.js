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
import {
  Subject,
  BehaviorSubject,
  interval
} from 'rxjs';
import { filter, startWith, takeUntil } from 'rxjs/operators';
import Daemon from './daemon';

const POLLING_INTERVAL = 1000;

export default class ChromeOsDaemon extends Daemon {
  constructor(chromeExtensionId) {
    super();
    this.channel = null;
    this.agentInfo = {};
    this.agentFound = new BehaviorSubject(null);
    this.wsConnected = new BehaviorSubject(null);
    this.appMessages = new Subject();
    this.error = new Subject();

    this.appMessages
      .subscribe(this.handleAppMessage.bind(this));

    this.wsConnected
      .subscribe(wsConnected => {
        if (wsConnected) {
          interval(POLLING_INTERVAL)
            .pipe(startWith(0))
            .pipe(takeUntil(this.wsConnected.pipe(filter(status => !status))))
            .subscribe(() => this.channel.postMessage({
              command: 'listPorts'
            }));
        }
        else {
          this._wsConnect(chromeExtensionId);
          this.agentFound.next(false);
        }
      });

    // close all ports?
  }

  /**
   * Instantiate connection and events listeners for chrome app
   */
  _wsConnect(chromeExtensionId) {
    if (chrome.runtime) {
      this.channel = chrome.runtime.connect(chromeExtensionId);
      this.channel.onMessage.addListener(message => {
        if (message.version) {
          this.agentInfo = message;
          this.agentFound.next(true);
          this.wsConnected.next(true);
        }
        else {
          this.appMessages.next(message);
        }
      });
      this.channel.onDisconnect.addListener(() => {
        this.wsConnected.next(false);
        this.agentFound.next(false);
      });
    }
  }

  handleAppMessage(message) {
    if (message.ports) {
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

    if (message.supportedBoards) {
      this.supportedBoards.next(message.supportedBoards);
    }
  }
}
