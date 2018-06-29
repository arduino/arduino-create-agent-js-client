import { Subject } from 'rxjs';

export default class ReaderWriter {
  constructor() {
    this.socket = null;
    this.pluginURL = null;
    this.messageSubject = new Subject();
    this.devicesList = {
      serial: [],
      network: []
    };
    this.messageSubject.subscribe(this.updateDevicesList.bind(this));
    this.openingSerial = null;
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
      console.log(this.devicesList);
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
        let data = null;
        try {
          data = JSON.parse(message);
        }
        catch (SyntaxError) {
          return;
        }
        if (data.Cmd === 'Open') {
          return resolve();
        }
        if (data.Cmd === 'OpenFail') {
          return reject(new Error('Failed to open serial'));
        }
      };
      this.messageSubject.subscribe(checkOpen);
    }).finally(() => {
      this.openingSerial = null;
    });
    this.socket.emit('command', `open ${port} 9600 timed`);
    return this.openingSerial;
  }

}
