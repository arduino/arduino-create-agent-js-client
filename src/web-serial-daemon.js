import { Uploader } from '@bcmi-labs/arduino-chromeos-uploader';
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
    this.uploader = new Uploader({
      logger: console,
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
        this.supportedBoards.next(supportedBoards);

      }
    });

  }

  // // Specific for serial web API on chromebooks
  // // eslint-disable-next-line class-methods-use-this
  // async connectToSerialDevice() {
  //   this.port = this.webSerialManager.connect();
  //   return this.port;
  // }

  // eslint-disable-next-line class-methods-use-this
  closeSerialMonitor() {
    // TODO: it's a NO OP at the moment
  }

  handleAppMessage(message) {
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
  // eslint-disable-next-line class-methods-use-this
  closeAllPorts() {
    console.log('should be closing serial ports here');
    // const devices = this.devicesList.getValue().serial;
    // TODO: do something to close the seriap ports...
  }

  // async cdcReset() {
  //   this.webSerialManager.cdcReset();
  // }

  // async askPermissionAndCdcReset() {
  //   const port = await this.connectToSerialDevice();
  //   const { usbVendorId, usbProductId } = port.getInfo();
  //   this.webSerialManager.cdcReset();
  //   this.appMessages.next({
  //     ports: [{
  //       Name: `Board-${usbVendorId}-${usbProductId}`,
  //       SerialNumber: `${usbVendorId}-${usbProductId}`,
  //       IsOpen: true,
  //       VendorID: `0x${usbVendorId.toString(16).padStart(4, 0)}`,
  //       ProductID: `0x${usbProductId.toString(16).padStart(4, 0)}`,
  //       // type: 'web-serial'
  //       serialAPI: 'web'
  //     }]
  //   });
  // }

  /**
   * Request serial port open
   * @param {string} port the port name
   */
  openSerialMonitor(port) {
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

  }

  /**
   * @param {object} uploadPayload
   * TODO: document param's shape
   */
  async _upload(uploadPayload) {
    try {
      await this.uploader.upload(uploadPayload);
      this.uploading.next({ status: this.UPLOAD_DONE, msg: 'Sketch uploaded' });
    }
    catch (error) {
      console.error(error);
      this.notifyUploadError(error.message);
    }
  }
}
