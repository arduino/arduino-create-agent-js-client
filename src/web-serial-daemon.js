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

    this._populateSupportedBoards();
  }

  _populateSupportedBoards() {
    const supportedBoards = this.uploader.getSupportedBoards();
    this.appMessages.next({ supportedBoards });
  }

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

    if (message.supportedBoards) {
      this.supportedBoards.next(message.supportedBoards);
    }
  }

  /**
   * Send 'close' command to all the available serial ports
   */
  // eslint-disable-next-line class-methods-use-this
  closeAllPorts() {
    console.log('should be closing serial ports here');
  }

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

  cdcReset({ fqbn }) {
    return this.uploader.cdcReset({ fqbn })
      .then(() => {
        this.uploading.next({ status: this.CDC_RESET_DONE, msg: 'Touch operation succeeded' });
      })
      .catch(error => {
        this.notifyUploadError(error.message);
      });
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
