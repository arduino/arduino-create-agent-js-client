import { Subject, BehaviorSubject, interval } from 'rxjs';
import { takeUntil, filter, startWith } from 'rxjs/operators';

const POLLING_INTERVAL = 1500;
const UPLOAD_NOPE = 'UPLOAD_NOPE';

export default class Daemon {
  constructor() {
    this.agentInfo = {};
    this.agentFound = new BehaviorSubject(null);
    this.channelOpen = new BehaviorSubject(null);
    this.error = new Subject();
    this.appMessages = new Subject();
    this.serialMonitorOpened = new BehaviorSubject(false);
    this.serialMonitorMessages = new Subject();
    this.uploading = new BehaviorSubject({ status: UPLOAD_NOPE });
    this.devicesList = new BehaviorSubject({
      serial: [],
      network: []
    });
    this.supportedBoards = new BehaviorSubject([]);
    this.appMessages
      .subscribe(this.handleAppMessage.bind(this));

    const devicesListSubscription = this.devicesList.subscribe((devices) => {
      if (devices.serial && devices.serial.length > 0) {
        this.closeAllPorts();
        devicesListSubscription.unsubscribe();
      }
    });
  }

  openChannel(cb) {
    this.channelOpen
      .subscribe(open => {
        if (open) {
          interval(POLLING_INTERVAL)
            .pipe(startWith(0))
            .pipe(takeUntil(this.channelOpen.pipe(filter(status => !status))))
            .subscribe(cb);
        }
        else {
          this.agentFound.next(false);
        }
      });
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
    return a.every((item, index) => (b[index].Name === item.Name && b[index].IsOpen === item.IsOpen));
  }

  /**
   * Download tool - not supported in Chrome app
   * @param {string} toolName
   * @param {string} toolVersion
   * @param {string} packageName
   * @param {string} replacementStrategy
   */
  downloadTool(toolName, toolVersion, packageName, replacementStrategy = 'keep') {
    if (typeof this.downloadToolCommand === 'function') {
      this.downloadToolCommand(toolName, toolVersion, packageName, replacementStrategy);
    }
    else {
      throw new Error('Download Tool not supported on Chrome OS');
    }
  }

  /**
   * Interrupt upload - not supported in Chrome app
   */
  stopUpload() {
    if (typeof this.stopUploadCommand === 'function') {
      this.stopUploadCommand();
    }
    throw new Error('Stop Upload not supported on Chrome OS');
  }
}
