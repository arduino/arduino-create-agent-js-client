import {
  filter, takeUntil
} from 'rxjs/operators';
import Daemon from './daemon';

/**
 * WARNING: the WebSerialDaemon with support for the Web Serial API is still in an alpha version.
 * At the moment it doesn't implement all the features available in the Chrome App Deamon
 * Use at your own risk.
 *
 * The `uploader` parameter in the constructor is the component which is
 * used to interact with the Web Serial API.
 * It must provide a method `upload`.
 */
export default class WebSerialDaemon extends Daemon {
  constructor(boardsUrl, uploader) {
    super(boardsUrl);
    this.port = null;
    this.agentFound.next(true);
    this.channelOpenStatus.next(true);
    this.uploader = uploader;
    this.connectedPorts = [];

    this.init();
  }

  init() {
    const supportedBoards = this.uploader.getSupportedBoards();
    this.appMessages.next({ supportedBoards });

    this.uploader.listBoards().then(ports => {
      this.connectedPorts = ports;
      this.appMessages.next({ ports });
    });

    this.uploader.on('data', data => this.serialMonitorMessages.next(data));
  }

  handleAppMessage(message) {
    if (message.ports) {
      this.devicesList.next({
        serial: message.ports,
        network: []
      });
    }
    else if (message.supportedBoards) {
      this.supportedBoards.next(message.supportedBoards);
    }
    else if (message.connectedSerialPort) {
      const port = this.uploader.getBoardInfoFromSerialPort(message.connectedSerialPort);
      this.connectedPorts.push(port);
      this.devicesList.next({
        serial: this.connectedPorts,
        network: []
      });
    }
    else if (message.disconnectedSerialPort) {
      const port = this.uploader.getBoardInfoFromSerialPort(message.disconnectedSerialPort);
      this.connectedPorts = this.connectedPorts.filter(connectedPort => connectedPort.Name !== port.Name);
      this.devicesList.next({
        serial: this.connectedPorts,
        network: []
      });
    }
  }

  /**
   * Send 'close' command to all the available serial ports
   */
  // eslint-disable-next-line class-methods-use-this
  closeAllPorts() {
    console.log('should be closing serial ports here');
    this.uploader.closeAllPorts();
  }

  /**
   * Request serial port open
   * @param {string} port the port name
   */
  openSerialMonitor(port) {
    if (this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
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

    this.uploader.openPort(serialPort)
      .then(ports => {
        this.appMessages.next({ portOpenStatus: 'success' });
        this.appMessages.next({ ports });
      })
      .catch(() => this.appMessages.next({ portOpenStatus: 'error' }));
  }

  closeSerialMonitor(port) {
    if (!this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorError.next(`Can't find port ${port}`);
    }
    this.appMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => !open))))
      .subscribe(message => {
        if (message.portCloseStatus === 'success') {
          this.serialMonitorOpened.next(false);
        }
        if (message.portCloseStatus === 'error') {
          this.serialMonitorError.next(`Failed to close serial ${port}`);
        }
      });
    this.uploader.closePort(serialPort)
      .then(ports => {
        this.appMessages.next({ portCloseStatus: 'success' });
        this.appMessages.next({ ports });
      })
      .catch(() => this.appMessages.next({ portCloseStatus: 'error' }));

  }

  cdcReset({ fqbn }) {
    return this.uploader.cdcReset({ fqbn })
      .then(() => {
        this.uploading.next({ status: this.CDC_RESET_DONE, msg: 'Touch operation succeeded' });
      })
      .catch(error => {
        this.notifyUploadError(error.message);
      });
  }

  /** A proxy method to get info from the specified SerialPort object */
  getBoardInfoFromSerialPort(serialPort) {
    return this.uploader.getBoardInfoFromSerialPort(serialPort);
  }

  connectToSerialDevice() {
    return this.uploader.connectToSerialDevice();
  }

  /**
   * @param {object} uploadPayload
   * TODO: document param's shape
   */
  _upload(uploadPayload) {
    return this.uploader.upload(uploadPayload)
      .then(() => {
        this.uploading.next({ status: this.UPLOAD_DONE, msg: 'Sketch uploaded' });
      })
      .catch(error => {
        this.notifyUploadError(error.message);
      });
  }
}
