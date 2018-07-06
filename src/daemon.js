import { Subject, BehaviorSubject, interval } from 'rxjs';
import { takeUntil, filter, startWith } from 'rxjs/operators';

const UPLOAD__NOPE = 'UPLOAD__NOPE';
const UPLOAD__DONE = 'UPLOAD__DONE';
const UPLOAD__ERROR = 'UPLOAD__ERROR';
const UPLOAD__IN_PROGRESS = 'UPLOAD__IN_PROGRESS';

const POLLING_INTERVAL = 1500;

export default class Daemon {
  constructor() {
    this.agentInfo = {};
    this.agentFound = new BehaviorSubject(null);
    this.channelOpen = new BehaviorSubject(null);
    this.error = new Subject();
    this.appMessages = new Subject();
    this.serialMonitorOpened = new BehaviorSubject(false);
    this.serialMonitorMessages = new Subject();
    this.uploading = new BehaviorSubject({ status: UPLOAD__NOPE });
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

  handleAppMessage(message) {
    // Result of a list command
    if (message.Ports) {
      this.handleListMessage(message);
    }
    // Serial monitor message
    if (message.D) {
      this.serialMonitorMessages.next(message.D);
    }

    if (message.ProgrammerStatus) {
      this.handleUploadMessage(message);
    }

    if (message.Err) {
      this.uploading.next({ status: UPLOAD__ERROR, err: message.Err });
    }
  }

  handleListMessage(message) {
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

  handleUploadMessage(message) {
    if (this.uploading.getValue().status !== UPLOAD__IN_PROGRESS) {
      return;
    }
    if (message.Flash === 'Ok' && message.ProgrammerStatus === 'Done') {
      this.uploading.next({ status: UPLOAD__DONE, msg: message.Flash });
      return;
    }
    switch (message.ProgrammerStatus) {
      case 'Starting':
        this.uploading.next({ status: UPLOAD__IN_PROGRESS, msg: `Programming with: ${message.Cmd}` });
        break;
      case 'Busy':
        this.uploading.next({ status: UPLOAD__IN_PROGRESS, msg: message.Msg });
        break;
      case 'Error':
        this.uploading.next({ status: UPLOAD__ERROR, err: message.Msg });
        break;
      case 'Killed':
        this.uploading.next({ status: UPLOAD__IN_PROGRESS, msg: `terminated by user` });
        this.uploading.next({ status: UPLOAD__ERROR, err: `terminated by user` });
        break;
      case 'Error 404 Not Found':
        this.uploading.next({ status: UPLOAD__ERROR, err: message.Msg });
        break;
      default:
        this.uploading.next({ status: UPLOAD__IN_PROGRESS, msg: message.Msg });
    }
  }

  /**
   * Perform an upload via http on the daemon
   * target = {
   *       board: "name of the board",
   *       port: "port of the board",
   *       auth_user: "Optional user to use as authentication",
   *       auth_pass: "Optional pass to use as authentication"
   *       auth_key: "Optional private key",
   *       auth_port: "Optional alternative port (default 22)"
   *       network: true or false
   *    }
   *    data = {
   *       commandline: "commandline to execute",
   *       signature: "signature of the commandline",
   *       files: [
   *          {name: "Name of a file to upload on the device", data: 'base64data'}
   *       ],
   *       options: {}
   *    }
   *    cb = callback function executing everytime a packet of data arrives through the websocket
   */
  upload(target, data) {
    this.uploading.next({ status: UPLOAD__IN_PROGRESS });

    if (data.files.length === 0) { // At least one file to upload
      this.uploading.next({ status: UPLOAD__ERROR, err: 'You need at least one file to upload' });
      return;
    }

    // Main file
    const file = data.files[0];
    file.name = file.name.split('/');
    file.name = file.name[file.name.length - 1];

    const payload = {
      board: target.board,
      port: target.port,
      commandline: data.commandline,
      signature: data.signature,
      hex: file.data,
      filename: file.name,
      extra: {
        auth: {
          username: target.auth_user,
          password: target.auth_pass,
          private_key: target.auth_key,
          port: target.auth_port
        },
        wait_for_upload_port: data.options.wait_for_upload_port === 'true' || data.options.wait_for_upload_port === true,
        use_1200bps_touch: data.options.use_1200bps_touch === 'true' || data.options.use_1200bps_touch === true,
        network: target.network,
        ssh: target.ssh,
        params_verbose: data.options.param_verbose,
        params_quiet: data.options.param_quiet,
        verbose: data.options.verbose
      },
      extrafiles: data.extrafiles || []
    };

    for (let i = 1; i < data.files.length; i += 1) {
      payload.extrafiles.push({ filename: data.files[i].name, hex: data.files[i].data });
    }

    fetch(`${this.pluginURL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: JSON.stringify(payload)
    })
      .catch(error => {
        this.uploading.next({ status: UPLOAD__ERROR, err: error });
      });
  }
}
