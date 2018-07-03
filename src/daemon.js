import { Subject, BehaviorSubject } from 'rxjs';

export default class Daemon {
  constructor() {
    this.socket = null;
    this.pluginURL = null;
    this.messageBus = new Subject();
    this.serialMonitor = new Subject();
    this.devicesList = new BehaviorSubject({
      serial: [],
      network: []
    });
    this.messageBus.subscribe(this.updateDevicesList.bind(this));
    this.openingSerial = null;
    this.closingSerial = null;
  }

  initSocket() {
    this.socket.on('message', this.parseMessage.bind(this));
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

  updateDevicesList(devicesInfo) {
    // Result of a list command
    if (devicesInfo.Ports) {
      const lastDevices = this.devicesList.getValue();
      if (devicesInfo.Network && !Daemon.devicesListAreEquals(lastDevices.network, devicesInfo.Ports)) {
        this.devicesList.next({
          serial: lastDevices.serial,
          network: devicesInfo.Ports
        });
      }
      else if (!devicesInfo.Network && !Daemon.devicesListAreEquals(lastDevices.serial, devicesInfo.Ports)) {
        this.devicesList.next({
          serial: devicesInfo.Ports,
          network: lastDevices.network
        });
      }
    }
  }

  parseMessage(message) {
    try {
      this.messageBus.next(JSON.parse(message));
    }
    catch (SyntaxError) {
      this.messageBus.next(message);
    }
  }

  openSerialMonitor(port) {
    if (this.openingSerial) {
      return this.openingSerial;
    }
    const serialPort = this.devicesList.serial.find(p => p.Name === port);
    if (!serialPort) {
      return Promise.reject(new Error('No board found'));
    }
    if (serialPort.IsOpen) {
      return Promise.resolve();
    }
    let checkOpen = null;
    this.openingSerial = new Promise((resolve, reject) => {
      checkOpen = message => {
        if (message.Cmd === 'Open') {
          this.readSerial();
          return resolve();
        }
        if (message.Cmd === 'OpenFail') {
          return reject(new Error('Failed to open serial'));
        }
      };
      this.openSubscription = this.messageBus.subscribe(checkOpen);
    }).finally(() => {
      this.openSubscription.unsubscribe();
      this.openingSerial = null;
    });
    this.socket.emit('command', `open ${port} 9600 timed`);
    return this.openingSerial;
  }

  closeSerialMonitor(port) {
    if (this.closingSerial) {
      return this.closingSerial;
    }
    const serialPort = this.devicesList.serial.find(p => p.Name === port);
    if (!serialPort) {
      return Promise.reject(new Error('No board found'));
    }
    if (!serialPort.IsOpen) {
      if (!this.readSerialSubscription) {
        this.readSerialSubscription.unsubscribe();
      }
      return Promise.resolve();
    }
    let checkClosed = null;
    this.closingSerial = new Promise((resolve, reject) => {
      checkClosed = message => {
        if (message.Cmd === 'Close') {
          return resolve();
        }
        if (message.Cmd === 'CloseFail') {
          return reject(new Error('Failed to close serial'));
        }
      };
      this.closeSubscription = this.messageBus.subscribe(checkClosed);
    }).finally(() => {
      this.closeSubscription.unsubscribe();
      this.closingSerial = null;
    });
    this.socket.emit('command', `close ${port}`);
    return this.closingSerial;
  }

  readSerial() {
    const onMessage = message => {
      if (message.D) {
        this.serialMonitor.next(message.D);
      }
    };
    if (!this.readSerialSubscription) {
      this.readSerialSubscription = this.messageBus.subscribe(onMessage);
    }
  }
}
