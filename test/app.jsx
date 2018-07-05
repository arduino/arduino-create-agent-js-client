import React from 'react';
import Daemon from '../src';

const UPLOAD_STATUS_NOPE = 'UPLOAD_STATUS_NOPE';
const UPLOAD_STATUS_DONE = 'UPLOAD_STATUS_DONE';
const UPLOAD_STATUS_ERROR = 'UPLOAD_STATUS_ERROR';
const UPLOAD_STATUS_IN_PROGRESS = 'UPLOAD_STATUS_IN_PROGRESS';


const scrollToBottom = (target) => {
  if (target) {
    target.scrollTop = target.scrollHeight; // eslint-disable-line no-param-reassign
  }
};

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
      ulploadError: ''
    };
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleSend = this.handleSend.bind(this);
    this.showError = this.showError.bind(this);
    this.clearError = this.clearError.bind(this);
    this.handleUpload = this.handleUpload.bind(this);
    this.daemon = Daemon;
  }

  componentDidMount() {
    this.daemon.agentFound.subscribe(status => {
      this.setState({
        agentStatus: status,
        agentInfo: JSON.stringify(this.daemon.agentInfo, null, 2)
      });
    });

    this.daemon.wsConnected.subscribe(status => {
      this.setState({ wsStatus: status });
    });

    this.daemon.error.subscribe(this.showError);

    this.daemon.devicesList.subscribe(devices => this.setState({
      serialDevices: devices.serial,
      networkDevices: devices.network
    }));

    const serialTextarea = document.getElementById('serial-textarea');

    this.daemon.serialMonitorMessages.subscribe(message => {
      this.setState({
        serialMonitorContent: this.state.serialMonitorContent + message
      });
      scrollToBottom(serialTextarea);
    });

    this.daemon.uploading.subscribe(upload => {
      this.setState({ uploadStatus: upload.status });
      console.log(upload);
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
    this.daemon.openSerialMonitor(port);
    this.setState({ serialPortOpen: port });
  }

  handleClose(e, port) {
    e.preventDefault();
    this.daemon.closeSerialMonitor(port);
    this.setState({ serialPortOpen: null });
  }

  handleSend(e) {
    e.preventDefault();
    const serialInput = document.getElementById('serial-input');
    const sendData = `${serialInput.value}\n`;
    this.daemon.writeSerial(this.state.serialPortOpen, sendData);
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
        data: '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CgD/////AgABAAAAAwAAAAEAAAAEAAAACwD/////AwAAAAAABAAAAAEAAAAcAAAABAAAAAAA/wAAAAAABQAAAAEAAAAcAAAABQABAAEA/wAAAAAABgAAAAEAAAAEAAAABgD//////wAAAAAABwAAAAEAAAAEAAAABwD//////wAAAAAAGAAAAAYAAAAAAAAA/wD//////wAAAAAAGQAAAAYAAAAAAAAA/wD//////wAAAAAAEgAAAAgAAAAEAAAA/wD//////wAAAAAAAwAAAAgAAAAEAAAA/wD//////wAAAAAADAAAAAIAAAAAAAAA/wD//////wAAAAAADQAAAAIAAAAAAAAA/wD//////wAAAAAADgAAAAgAAAAAAAAA/wD//////wAAAAAADwAAAAIAAAAAAAAA/wD//////wAAAAAAGwAAAAgAAAAAAAAA/wD//////wAAAAAAHAAAAAgAAAAAAAAA/wD//////wABAAAACAAAAAgAAAAAAAAA/wD//////wABAAAACQAAAAgAAAAAAAAA/wD/////CQAAAAAAAAAAAAgAAAAAAAAA/wD//////wAAAAAAAQAAAAgAAAAAAAAA/wD//////wAAAAAAAAAAAPUjAAAhJAAA8SMAABUkAAAJJAAAWSQAAD0kAAAAAAAAAAAAAAAAAACdKAAAgScAAMkmAAAAAAAAQXJkdWlubyBMTEMABAMJBBIBAALvAgFAQSNOgAABAQIDAUFyZHVpbm8gTUtSMTAwMAAAAAAAAAAAAAAAAAAAAJk3AADRPQAA2zYAAJ02AAC1NgAAUTgAAHU0AABlNAAAnTUAAIs0AABhNAAAAAAAAEMAAAAAAAAAAMIBAAAACAD/////CAsAAgICAAAJBAAAAQICAAAFJAAQAQQkAgYFJAYAAQUkAQEBBwWBAxAAEAkEAQACCgAAAAcFAgJAAAAHBYMCQAAAAAD/////AAAAAIMAAAACAAAAggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBCDwD/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACoRQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhAAAIN0gAABdIQAAHSUAAFE0AAC1IAAAAAAAAA=='
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
    this.daemon.upload(target, data);
  }

  render() {
    const listSerialDevices = this.state.serialDevices.map((device, i) => (<li key={i}>{device.Name} - IsOpen: <span className={device.IsOpen ? 'open' : 'closed'}>{device.IsOpen ? 'true' : 'false'}</span> - <a href="#" onClick={(e) => this.handleOpen(e, device.Name)}>open</a> - <a href="#" onClick={(e) => this.handleClose(e, device.Name)}>close</a></li>));
    const listNetworkDevices = this.state.networkDevices.map((device, i) => <li key={i}>{device.Name}</li>);
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
        <p>Agent status: <span id="agent-status" className={ this.state.agentStatus ? 'found' : 'not-found' }>
          { this.state.agentStatus ? 'Found' : 'Not found' }
        </span></p>
        <p>Web socket status: <span id="ws-status" className={ this.state.wsStatus ? 'found' : 'not-found' }>
          { this.state.wsStatus ? 'Connected' : 'Not connected' }
        </span></p>
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
