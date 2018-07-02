import { Subject } from 'rxjs';

export default class ReaderWriter {
  constructor() {
    this.socket = null;
    this.pluginURL = null;
    this.messageSubject = new Subject();
    this.serialMonitorSubject = new Subject();
    this.devicesList = {
      serial: [],
      network: []
    };
    this.messageSubject.subscribe(this.updateDevicesList.bind(this));
    this.openingSerial = null;
    this.closingSerial = null;
  }

  initSocket(socket) {
    this.socket = socket;
    this.socket.on('message', this.parseMessage.bind(this));
  }

  initPluginUrl(pluginUrl) {
    this.pluginURL = pluginUrl;
  }

  updateDevicesList(devicesInfo) {
    // Result of a list command
    if (devicesInfo.Ports) {
      if (devicesInfo.Network) {
        this.devicesList.network = devicesInfo.Ports;
      }
      else {
        this.devicesList.serial = devicesInfo.Ports;
      }
    }
  }

  parseMessage(message) {
    let jsonMessage;
    try {
      jsonMessage = JSON.parse(message);
    }
    catch (SyntaxError) {
      return;
    }

    if (jsonMessage) {
      this.messageSubject.next(jsonMessage);
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
      this.openSubscription = this.messageSubject.subscribe(checkOpen);
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
      this.closeSubscription = this.messageSubject.subscribe(checkClosed);
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
        this.serialMonitorSubject.next(message.D);
      }
    };
    if (!this.readSerialSubscription) {
      this.readSerialSubscription = this.messageSubject.subscribe(onMessage);
    }
  }
}
