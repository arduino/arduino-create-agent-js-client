import { WebSerialManager } from '@bcmi-labs/arduino-chromeos-uploader';
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
  }

  // Specific for serial web API on chromebooks
  async requestSerialPortAccess() {
    this.webSerialManager = new WebSerialManager({
      filters: [{ usbVendorId: 0x2341 }]
    });
    await this.webSerialManager.connect();
  }

  // eslint-disable-next-line class-methods-use-this
  closeSerialMonitor() {
    // TODO: it's a NO OP at the moment
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
      // device.close();
      // this.channel.postMessage({
      //   command: 'closePort',
      //   data: {
      //     name: device.Name
      //   }
      // });
    });
  }

  async _upload(uploadPayload) {

    console.dir('******** BEGIN: web-serial-daemon:105 ********');
    console.dir(uploadPayload.hex.length, { depth: null, colors: true });
    console.dir(uploadPayload.data.length, { depth: null, colors: true });
    console.dir('********   END: web-serial-daemon:105 ********');

    try {
      await this.webSerialManager.flashSketch(Uint8Array.from(atob(uploadPayload.data), c => c.charCodeAt(0)));
      this.uploading.next({ status: this.UPLOAD_DONE, msg: 'Sketch uploaded' });
    }
    catch (error) {
      this.notifyUploadError(error.message);
    }
  }
}
