/*
* Copyright 2018 ARDUINO SA (http://www.arduino.cc/)
* This file is part of arduino-create-agent-js-client.
* Copyright (c) 2018
* Authors: Alberto Iannaccone, Stefania Mellai, Gabriele Destefanis
*
* This software is released under:
* The GNU General Public License, which covers the main part of
* arduino-create-agent-js-client
* The terms of this license can be found at:
* https://www.gnu.org/licenses/gpl-3.0.en.html
*
* You can be released from the requirements of the above licenses by purchasing
* a commercial license. Buying such a license is mandatory if you want to modify or
* otherwise use the software for commercial activities involving the Arduino
* software without disclosing the source code of your own applications. To purchase
* a commercial license, send an email to license@arduino.cc.
*
*/

import React from 'react';
import Daemon from '../src';

import { HEX } from './serial_mirror';
// import V2 from './v2/v2.jsx';

const chromeExtensionID = 'hfejhkbipnickajaidoppbadcomekkde';

const scrollToBottom = (target) => {
  if (target) {
    target.scrollTop = target.scrollHeight; // eslint-disable-line no-param-reassign
  }
};

const daemon = new Daemon('https://builder.arduino.cc/v3/boards', chromeExtensionID);

const handleUpload = () => {
  const target = {
    board: 'arduino:samd:mkr1000',
    port: '/dev/ttyACM0',
    network: false
  };

  // Upload a compiled sketch.
  daemon.uploadSerial(target, 'serial_mirror', { bin: HEX });
};

const handleBootloaderMode = (e, port) => {
  e.preventDefault();
  daemon.setBootloaderMode(port);
};

const handleDownloadTool = e => {
  e.preventDefault();
  const toolname = document.getElementById('toolname');
  const toolversion = document.getElementById('toolversion');
  const packageName = document.getElementById('package');
  const replacement = document.getElementById('replacement');
  daemon.downloadTool(toolname.value, toolversion.value, packageName.value, replacement.value);
  toolname.value = '';
  toolversion.value = '';
  packageName.value = '';
  replacement.value = '';
};

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      error: '',
      agentStatus: false,
      channelStatus: false,
      serialDevices: [],
      networkDevices: [],
      agentInfo: '',
      serialMonitorContent: '',
      serialPortOpen: '',
      uploadStatus: '',
      uploadError: '',
      downloadStatus: '',
      downloadError: '',
      serialInput: '',
      supportedBoards: []
    };
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleSend = this.handleSend.bind(this);
    this.handleChangeSerial = this.handleChangeSerial.bind(this);
    this.showError = this.showError.bind(this);
    this.clearError = this.clearError.bind(this);
  }

  componentDidMount() {
    daemon.agentFound.subscribe(status => {
      this.setState({
        agentStatus: status,
        agentInfo: JSON.stringify(daemon.agentInfo, null, 2)
      });
    });

    daemon.channelOpen.subscribe(status => {
      this.setState({ channelStatus: status });
    });

    daemon.error.subscribe(this.showError);

    daemon.devicesList.subscribe(({ serial, network }) => this.setState({
      serialDevices: serial,
      networkDevices: network
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

    daemon.uploading.subscribe(upload => {
      this.setState({ uploadStatus: upload.status, uploadError: upload.err });
      // console.log(upload);
    });

    if (daemon.downloading) {
      daemon.downloading.subscribe(download => {
        this.setState({ downloadStatus: download.status });
        // console.log(download);
      });
    }
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
    daemon.openSerialMonitor(port, 9600);
    this.setState({ serialPortOpen: port });
  }

  handleClose(e, port) {
    e.preventDefault();
    daemon.closeSerialMonitor(port);
    this.setState({ serialPortOpen: null });
  }

  handleChangeSerial(e) {
    this.setState({ serialInput: e.target.value });
  }

  handleSend(e) {
    e.preventDefault();
    const serialInput = document.getElementById('serial-input');
    const sendData = `${this.state.serialInput}\n`;
    daemon.writeSerial(this.state.serialPortOpen, sendData);
    serialInput.focus();
    this.setState({ serialInput: '' });
  }

  render() {
    const listSerialDevices = this.state.serialDevices.map((device, i) => <li key={i}>
      {device.Name} - IsOpen: <span className={device.IsOpen ? 'open' : 'closed'}>
        {device.IsOpen ? 'true' : 'false'}
      </span> - <a href="#" onClick={(e) => this.handleOpen(e, device.Name)}>
          open
      </a> - <a href="#" onClick={(e) => this.handleClose(e, device.Name)}>
          close
      </a> - <a href="#" onClick={(e) => handleBootloaderMode(e, device.Name)}>
          bootloader mode
      </a>
    </li>);

    const listNetworkDevices = this.state.networkDevices.map((device, i) => <li key={i}>
      {device.Name}
    </li>);

    const supportedBoards = this.state.supportedBoards.map((board, i) => <li key={i}>
      { board }
    </li>);

    let uploadClass;
    if (this.state.uploadStatus === daemon.UPLOAD_DONE) {
      uploadClass = 'success';
    }
    else if (this.state.uploadStatus === daemon.UPLOAD_ERROR) {
      uploadClass = 'error';
    }
    else if (this.state.uploadStatus === daemon.UPLOAD_IN_PROGRESS) {
      uploadClass = 'in-progress';
    }

    let downloadClass;
    if (this.state.downloadStatus === daemon.DOWNLOAD_DONE) {
      downloadClass = 'success';
    }
    else if (this.state.downloadStatus === daemon.DOWNLOAD_ERROR) {
      downloadClass = 'error';
    }
    else if (this.state.downloadStatus === daemon.DOWNLOAD_IN_PROGRESS) {
      downloadClass = 'in-progress';
    }

    return (
      <div>
        <h1>Arduino Create Plugin Client Demo</h1>

        <div className="section">
          <h2>Plugin info</h2>

          <p>
            Agent status: <span className={ this.state.agentStatus ? 'found' : 'not-found' }>
              { this.state.agentStatus ? 'Found' : 'Not found' }
            </span>
          </p>
          <p>
            Channel status: <span className={ this.state.channelStatus ? 'found' : 'not-found' }>
              { this.state.channelStatus ? 'Connected' : 'Not connected' }
            </span>
          </p>

          <pre>
            { this.state.agentInfo }
          </pre>
        </div>

        <div className="section">
          <h2>Connected Devices</h2>

          <strong>serial:</strong>
          <ul>
            { listSerialDevices }
          </ul>

          <strong>network:</strong>
          <ul>
            { listNetworkDevices }
          </ul>

          <p id="error"></p>
        </div>

        {
          this.state.supportedBoards.length
            ? <div className="section">
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
            <input aria-label="serial input" id="serial-input" value={this.state.serialInput} onChange={this.handleChangeSerial}/>
            <input type="submit" value="Send" />
          </form>

          <textarea aria-label="Serial Monitor output" id="serial-textarea" value={ this.state.serialMonitorContent } readOnly/>
        </div>

        {/* <div className="v2">
          <V2 daemon={daemon}></V2>
        </div> */}

        <div className="section">
          <h2>Upload a sample sketch on a MKR1000 at /dev/ttyACM0</h2>
          <button onClick={ handleUpload } disabled={ this.state.uploadStatus === daemon.UPLOAD_IN_PROGRESS }>Upload Sketch</button><br/>
          <div>Upload status: <span className={ uploadClass }> { this.state.uploadStatus }</span> <span>{ this.state.uploadError }</span></div>
        </div>

        { daemon.downloading ? <div className="section">
          <h2>Download tool (not supported on Chrome OS)</h2>

          <div>
            <p>Example:</p>
            <dl>
              <dt>Tool Name:</dt>
              <dd>windows-drivers</dd>

              <dt>Tool Version:</dt>
              <dd>latest</dd>

              <dt>Package:</dt>
              <dd>arduino</dd>

              <dt>Replacement Strategy:</dt>
              <dd>keep</dd>
            </dl>
          </div>

          <form onSubmit={handleDownloadTool}>
            <div><input id="toolname" placeholder="Tool Name"/></div>
            <div><input id="toolversion" placeholder="Tool Version" /></div>
            <div><input id="package" placeholder="Package" /></div>
            <div><input id="replacement" placeholder="Replacement strategy"/></div>

            <input type="submit" value="Download" />
            <div>Download status: <span className={ downloadClass }> { this.state.downloadStatus }</span></div>
          </form>
        </div> : null}

        <div className="section">
          <h2>Errors</h2>
          <div className="error">{ this.state.error }</div>
        </div>
      </div>
    );
  }
}

export default App;
