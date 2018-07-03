import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

export default class Daemon {
  constructor() {
    this.socket = null;
    this.pluginURL = null;
    this.socketMessages = new Subject();
    this.serialMonitorOpened = new BehaviorSubject(false);
    this.serialMonitorMessages = new Subject();
    this.devicesList = new BehaviorSubject({
      serial: [],
      network: []
    });
    this.socketMessages
      .subscribe(this.handleSocketMesage.bind(this));
    this.openingSerial = null;
    this.closingSerial = null;
  }

  initSocket() {
    this.socket.on('message', message => {
      try {
        this.socketMessages.next(JSON.parse(message));
      }
      catch (SyntaxError) {
        this.socketMessages.next(message);
      }
    });
  }

  initPluginUrl(pluginUrl) {
    this.pluginURL = pluginUrl;
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
    return a.every((item, index) => b[index].Name === item.Name);
  }

  handleSocketMesage(message) {
    // Result of a list command
    if (message.Ports) {
      const lastDevices = this.devicesList.getValue();
      if (message.Network && !Daemon.devicesListAreEquals(lastDevices.network, message.Ports)) {
        this.devicesList.next({
          serial: lastDevices.serial,
          network: message.Ports
        });
      }
      else if (!message.Network && !Daemon.devicesListAreEquals(lastDevices.serial, message.Ports)) {
        this.devicesList.next({
          serial: message.Ports,
          network: lastDevices.network
        });
      }
    }
    // Serial monitor message
    if (message.D) {
      this.serialMonitorMessages.next(message.D);
    }
  }

  openSerialMonitor(port) {
    if (this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorOpened.error(new Error(`Can't find port ${port}`));
    }
    this.socketMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => open))))
      .subscribe(message => {
        if (message.Cmd === 'Open') {
          this.serialMonitorOpened.next(true);
        }
        if (message.Cmd === 'OpenFail') {
          this.serialMonitorOpened.error(new Error(`Failed to open serial ${port}`));
        }
      });
    this.socket.emit('command', `open ${port} 9600 timed`);
  }

  closeSerialMonitor(port) {
    if (!this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorOpened.error(new Error(`Can't find port ${port}`));
    }
    this.socketMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => !open))))
      .subscribe(message => {
        if (message.Cmd === 'Close') {
          this.serialMonitorOpened.next(false);
        }
        if (message.Cmd === 'CloseFail') {
          this.serialMonitorOpened.error(new Error(`Failed to close serial ${port}`));
        }
      });
    this.socket.emit('command', `close ${port}`);
  }
}
