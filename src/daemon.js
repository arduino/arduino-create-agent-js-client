import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

const UPLOAD_STATUS_NOPE = 'UPLOAD_STATUS_NOPE';
const UPLOAD_STATUS_DONE = 'UPLOAD_STATUS_DONE';
const UPLOAD_STATUS_ERROR = 'UPLOAD_STATUS_ERROR';
const UPLOAD_STATUS_IN_PROGRESS = 'UPLOAD_STATUS_IN_PROGRESS';

export default class Daemon {
  constructor() {
    this.socket = null;
    this.pluginURL = null;
    this.socketMessages = new Subject();
    this.serialMonitorOpened = new BehaviorSubject(false);
    this.serialMonitorMessages = new Subject();
    this.uploading = new BehaviorSubject({ status: UPLOAD_STATUS_NOPE });
    this.devicesList = new BehaviorSubject({
      serial: [],
      network: []
    });
    this.socketMessages
      .subscribe(this.handleSocketMessage.bind(this));

    const devicesListSubscription = this.devicesList.subscribe((devices) => {
      if (devices.serial && devices.serial.length > 0) {
        this.closeAllPorts();
        devicesListSubscription.unsubscribe();
      }
    });
  }

  initSocket() {
    this.socket.on('message', message => {
      try {
        this.socketMessages.next(JSON.parse(message));
      }
      catch (SyntaxError) {
        this.socketMessages.next(message);
      }
    });
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
    return a.every((item, index) => (b[index].Name === item.Name && b[index].IsOpen === item.IsOpen));
  }

  handleSocketMessage(message) {
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
      this.uploading.next({ status: UPLOAD_STATUS_ERROR, err: message.Err });
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
    if (this.uploading.getValue().status !== UPLOAD_STATUS_IN_PROGRESS) {
      return;
    }
    if (message.Flash === 'Ok' && message.ProgrammerStatus === 'Done') {
      this.uploading.next({ status: UPLOAD_STATUS_DONE, msg: message.Flash });
      return;
    }
    switch (message.ProgrammerStatus) {
      case 'Starting':
        this.uploading.next({ status: UPLOAD_STATUS_IN_PROGRESS, msg: `Programming with: ${message.Cmd}` });
        break;
      case 'Busy':
        this.uploading.next({ status: UPLOAD_STATUS_IN_PROGRESS, msg: message.Msg });
        break;
      case 'Error':
        this.uploading.next({ status: UPLOAD_STATUS_ERROR, err: message.Msg });
        break;
      case 'Killed':
        this.uploading.next({ status: UPLOAD_STATUS_IN_PROGRESS, msg: `terminated by user` });
        this.uploading.next({ status: UPLOAD_STATUS_ERROR, err: `terminated by user` });
        break;
      case 'Error 404 Not Found':
        this.uploading.next({ status: UPLOAD_STATUS_ERROR, err: message.Msg });
        break;
      default:
        this.uploading.next({ status: UPLOAD_STATUS_IN_PROGRESS, msg: message.Msg });
    }
  }

  writeSerial(port, data) {
    this.socket.emit('command', `send ${port} ${data}`);
  }

  openSerialMonitor(port) {
    if (this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorOpened.error(new Error(`Can't find port ${port}`));
    }
    this.socketMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => open))))
      .subscribe(message => {
        if (message.Cmd === 'Open') {
          this.serialMonitorOpened.next(true);
        }
        if (message.Cmd === 'OpenFail') {
          this.serialMonitorOpened.error(new Error(`Failed to open serial ${port}`));
        }
      });
    this.socket.emit('command', `open ${port} 9600 timed`);
  }

  closeSerialMonitor(port) {
    if (!this.serialMonitorOpened.getValue()) {
      return;
    }
    const serialPort = this.devicesList.getValue().serial.find(p => p.Name === port);
    if (!serialPort) {
      return this.serialMonitorOpened.error(new Error(`Can't find port ${port}`));
    }
    this.socketMessages
      .pipe(takeUntil(this.serialMonitorOpened.pipe(filter(open => !open))))
      .subscribe(message => {
        if (message.Cmd === 'Close') {
          this.serialMonitorOpened.next(false);
        }
        if (message.Cmd === 'CloseFail') {
          this.serialMonitorOpened.error(new Error(`Failed to close serial ${port}`));
        }
      });
    this.socket.emit('command', `close ${port}`);
  }

  closeAllPorts() {
    const devices = this.devicesList.getValue().serial;
    devices.forEach(device => {
      this.socket.emit('command', `close ${device.Name}`);
    });
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
    this.uploading.next({ status: UPLOAD_STATUS_IN_PROGRESS });

    if (data.files.length === 0) { // At least one file to upload
      this.uploading.next({ status: UPLOAD_STATUS_ERROR, err: 'You need at least one file to upload' });
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
        this.uploading.next({ status: UPLOAD_STATUS_ERROR, err: error });
      });
  }


  stopUpload() {
    this.uploading.next(false);
    this.socket.emit('command', 'killprogrammer');
  }
}
