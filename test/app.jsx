import React from 'react';
import Daemon from '../src';

import { HEX } from './serial_mirror';

const UPLOAD_STATUS_NOPE = 'UPLOAD_STATUS_NOPE';
const UPLOAD_STATUS_DONE = 'UPLOAD_STATUS_DONE';
const UPLOAD_STATUS_ERROR = 'UPLOAD_STATUS_ERROR';
const UPLOAD_STATUS_IN_PROGRESS = 'UPLOAD_STATUS_IN_PROGRESS';


const scrollToBottom = (target) => {
  if (target) {
    target.scrollTop = target.scrollHeight; // eslint-disable-line no-param-reassign
  }
};

const daemon = new Daemon('hfejhkbipnickajaidoppbadcomekkde');

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      error: '',
      agentStatus: false,
      wsStatus: false,
      serialDevices: [],
      networkDevices: [],
      agentInfo: '',
      serialMonitorContent: '',
      serialPortOpen: '',
      uploadStatus: '',
      ulploadError: '',
      supportedBoards: []
    };
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleSend = this.handleSend.bind(this);
    this.showError = this.showError.bind(this);
    this.clearError = this.clearError.bind(this);
    this.handleUpload = this.handleUpload.bind(this);
  }

  componentDidMount() {
    daemon.agentFound.subscribe(status => {
      this.setState({
        agentStatus: status,
        agentInfo: JSON.stringify(daemon.agentInfo, null, 2)
      });
    });

    daemon.wsConnected.subscribe(status => {
      this.setState({ wsStatus: status });
    });

    daemon.error.subscribe(this.showError);

    daemon.devicesList.subscribe(devices => this.setState({
      serialDevices: devices.serial,
      networkDevices: devices.network
    }));

    daemon.supportedBoards.subscribe(boards => this.setState({
      supportedBoards: boards
    }));

    const serialTextarea = document.getElementById('serial-textarea');

    daemon.serialMonitorMessages.subscribe(message => {
      this.setState({
        serialMonitorContent: this.state.serialMonitorContent + message
      });
      scrollToBottom(serialTextarea);
    });

    this.uploadingSubscription = daemon.uploading.subscribe(upload => {
      this.setState({ uploadStatus: upload.status });
    });
  }

  showError(err) {
    this.setState({ error: err });
  }

  clearError() {
    this.setState({ error: '' });
  }

  handleOpen(e, port) {
    this.setState({ serialMonitorContent: '' });
    e.preventDefault();
    daemon.openSerialMonitor(port);
    this.setState({ serialPortOpen: port });
  }

  handleClose(e, port) {
    e.preventDefault();
    daemon.closeSerialMonitor(port);
    this.setState({ serialPortOpen: null });
  }

  handleSend(e) {
    e.preventDefault();
    const serialInput = document.getElementById('serial-input');
    const sendData = `${serialInput.value}\n`;
    daemon.writeSerial(this.state.serialPortOpen, sendData);
    serialInput.focus();
    serialInput.value = '';
  }

  handleUpload() {
    const target = {
      board: 'arduino:samd:mkr1000',
      port: '/dev/ttyACM1',
      network: false
    };

    const data = {
      files: [{
        name: 'serial_mirror.bin',
        data: HEX
      }],
      commandline: '\"{runtime.tools.bossac-1.7.0.path}/bossac\" {upload.verbose} --port={serial.port.file} -U true -i -e -w -v \"{build.path}/{build.project_name}.bin\" -R',
      signature: '66695789d14908f52cb1964da58ec9fa816d6ddb321900c60ad6ec2d84a7c713abb2b71404030c043e32cf548736eb706180da8256f2533bd132430896437c72b396abe19e632446f16e43b80b73f5cf40aec946d00e7543721cc72d77482a84d2d510e46ea6ee0aaf063ec267b5046a1ace36b7eb04c64b4140302586f1e10eda8452078498ab5c9985e8f5d521786064601daa5ba2978cf91cfeb64e83057b3475ec029a1b835460f4e203c1635eaba812b076248a3589cd5d84c52398f09d255f8aae25d66a40d5ab2b1700247defbdfd044c77d44078197d1f543800e11f79d6ef1c6eb46df65fe2fffd81716b11d798ba21a3ca2cb20f6d955d8e1f8aef',
      extrafiles: [],
      options: {
        wait_for_upload_port: true,
        use_1200bps_touch: true,
        params_verbose: '-v'
      }
    };
    daemon.upload(target, data);
  }

  render() {
    const listSerialDevices = this.state.serialDevices.map((device, i) =>
      <li key={i}>
        {device.Name} - IsOpen: <span className={device.IsOpen ? 'open' : 'closed'}>
          {device.IsOpen ? 'true' : 'false'}
        </span> - <a href="#" onClick={(e) => this.handleOpen(e, device.Name)}>
          open
        </a> - <a href="#" onClick={(e) => this.handleClose(e, device.Name)}>
          close
        </a>
      </li>);

    const listNetworkDevices = this.state.networkDevices.map((device, i) =>
      <li key={i}>
        {device.Name}
      </li>);

    const supportedBoards = this.state.supportedBoards.map((board, i) =>
      <li key={i}>
        { board }
      </li>);

    let uploadClass;
    if (this.state.uploadStatus === UPLOAD_STATUS_DONE) {
      uploadClass = 'success';
    }
    else if (this.state.uploadStatus === UPLOAD_STATUS_ERROR) {
      uploadClass = 'error';
    }
    else if (this.state.uploadStatus === UPLOAD_STATUS_IN_PROGRESS) {
      uploadClass = 'in-progress';
    }

    return (
      <div>
        <h1>Test Arduino Create Plugin</h1>

        <p>
          Agent status: <span id="agent-status" className={ this.state.agentStatus ? 'found' : 'not-found' }>
            { this.state.agentStatus ? 'Found' : 'Not found' }
          </span>
        </p>
        <p>
          Web socket status: <span id="ws-status" className={ this.state.wsStatus ? 'found' : 'not-found' }>
            { this.state.wsStatus ? 'Connected' : 'Not connected' }
          </span>
        </p>

        <pre id="agent-info">
          { this.state.agentInfo }
        </pre>

        <div className="section">
          <h2>Devices</h2>
          <strong>serial:</strong>
          <ul id="serial-list">
            { listSerialDevices }
          </ul>
          <strong>network:</strong>
          <ul id="network-list">
            { listNetworkDevices }
          </ul>
          <p id="error"></p>
        </div>

        {
          this.state.supportedBoards.length ?
            <div className="section">
              <h2>Supported boards</h2>
              <ul>
                {supportedBoards}
              </ul>
            </div>
            : null
        }

        <div className="serial-monitor section">
          <h2>Serial Monitor</h2>
          <form onSubmit={this.handleSend}>
            <input id="serial-input" />
            <input type="submit" value="Send" />
          </form>
          <textarea id="serial-textarea" value={ this.state.serialMonitorContent }/>
        </div>

        <div className="section">
          <button onClick={ this.handleUpload } disabled={ this.state.uploadStatus === UPLOAD_STATUS_IN_PROGRESS }>Upload Sketch</button>
          <div>Upload status: <span className={ uploadClass }> { this.state.uploadStatus }</span></div>
          <div>{ this.state.ulploadError }</div>
        </div>
      </div>
    );
  }
}

export default App;
