import { WebSerialManager } from '@bcmi-labs/arduino-chromeos-uploader';
import {
  filter, takeUntil
} from 'rxjs/operators';
import Daemon from './daemon';

// function mapSerialPortToDevice(port) {
//   const info = port.getInfo();
//   return {
//     Name: `Board-${info.usbVendorId}-${info.usbProductId}`,
//     SerialNumber: `${info.usbVendorId}-${info.usbProductId}`,
//     IsOpen: true,
//     VendorID: '0x2341', // String(info.usbVendorId),
//     ProductID: '0x0054', // String(info.usbProductId)
//     // type: 'web-serial'
//   };
// }

export default class WebSerialDaemon extends Daemon {
  constructor(boardsUrl) {
    super(boardsUrl);
    this.port = null;
    this.agentFound.next(true); // subscribe(() => true);
    this.channelOpenStatus.next(true); // subscribe(() => true);
    this.webSerialManager = new WebSerialManager({
      filters: [
        { usbVendorId: 0x2341 }
      ],
      disconnectCallback: () => {
        console.log('DISCONNECTED');
        // this.appMessages.next({ ports: [] });
      },
      connectCallback: () => {
        console.log('CONNECTED');
      },
      sendSupportedBoardsCallback: (supportedBoards) => {
        console.dir('******** BEGIN: web-serial-daemon:37 ********');
        console.dir(supportedBoards, { depth: null, colors: true });
        console.dir('********   END: web-serial-daemon:37 ********');
        this.supportedBoards.next(supportedBoards);

      }
    });

  }

  // Specific for serial web API on chromebooks
  // eslint-disable-next-line class-methods-use-this
  async connectToSerialDevice() {
    return this.webSerialManager.connect();
  }

  // eslint-disable-next-line class-methods-use-this
  closeSerialMonitor() {
    // TODO: it's a NO OP at the moment
  }

  handleAppMessage(message) {
    console.dir('******** BEGIN: web-serial-daemon:59 ********');
    console.dir(`handleAppMessage: ${message}`, { depth: null, colors: true });
    console.dir(message, { depth: null, colors: true });
    console.dir('********   END: web-serial-daemon:59 ********');
    if (message.ports) {
      this.devicesList.next({
        serial: message.ports,
        network: []
      });
      // this.handleListMessage(message);
    }
  }

  /**
   * Send 'close' command to all the available serial ports
   */
  closeAllPorts() {
    const devices = this.devicesList.getValue().serial;
    devices.forEach(device => {
      console.dir('******** BEGIN: web-serial-daemon:107 ********');
      console.dir(device, { depth: null, colors: true });
      console.dir('********   END: web-serial-daemon:107 ********');
    });
  }

  async cdcReset() {
    this.webSerialManager.cdcReset();
  }

  async askPermissionAndCdcReset() {
    const port = await this.connectToSerialDevice();
    const { usbVendorId, usbProductId } = port.getInfo();
    this.webSerialManager.cdcReset();
    this.appMessages.next({
      ports: [{
        Name: `Board-${usbVendorId}-${usbProductId}`,
        SerialNumber: `${usbVendorId}-${usbProductId}`,
        IsOpen: true,
        VendorID: `0x${usbVendorId.toString(16).padStart(4, 0)}`,
        ProductID: `0x${usbProductId.toString(16).padStart(4, 0)}`,
        // type: 'web-serial'
        serialAPI: 'web'
      }]
    });
  }

  /**
   * Request serial port open
   * @param {string} port the port name
   */
  openSerialMonitor(port, baudrate) {
    console.dir('******** BEGIN: web-serial-daemon:90 ********');
    console.dir(port, { depth: null, colors: true });
    console.dir('********   END: web-serial-daemon:90 ********');
    if (this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial[0]; // .find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorError.next(`Can't find port ${port}`);
    }
    this.appMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => open))))
      .subscribe(message => {
        if (message.portOpenStatus === 'success') {
          this.serialMonitorOpened.next(true);
        }
        if (message.portOpenStatus === 'error') {
          this.serialMonitorError.next(`Failed to open serial ${port}`);
        }
      });

    console.dir('******** BEGIN: web-serial-daemon:111 ********');
    console.dir(this.webSerialManager, { depth: null, colors: true });
    console.dir('********   END: web-serial-daemon:111 ********');
    this.webSerialManager.cdcReset(serialPort, baudrate);
  }

  async _upload(uploadPayload) {
    try {
      await this.webSerialManager.flashSketch(Uint8Array.from(atob(uploadPayload.data), c => c.charCodeAt(0)));
      this.uploading.next({ status: this.UPLOAD_DONE, msg: 'Sketch uploaded' });
    }
    catch (error) {
      this.notifyUploadError(error.message);
    }
  }
}
