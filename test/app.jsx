import React from 'react';
import Daemon from '../src';
import { WS_STATUS_CONNECTED, AGENT_STATUS_FOUND } from '../src/socket-daemon';

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
      agentStatus: '-',
      wsStatus: '-',
      serialDevices: [],
      networkDevices: [],
      agentInfo: '',
      serialMonitorContent: ''
    };

    this.connect = this.connect.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  componentDidMount() {
    Daemon.agentDiscoveryStatus.subscribe(status => {
      this.setState({
        agentStatus: status,
        agentInfo: JSON.stringify(Daemon.agentInfo, null, 2)
      });
    });

    Daemon.wsConnectionStatus.subscribe(status => {
      this.setState({ wsStatus: status });
    });

    Daemon.wsError.subscribe(this.showError);

    Daemon.readerWriter.messageSubject.subscribe(() => {
      this.setState({
        serialDevices: Daemon.readerWriter.devicesList.serial,
        networkDevices: Daemon.readerWriter.devicesList.network
      });
    });

    const serialTextarea = document.getElementById('serial-textarea');
    Daemon.readerWriter.serialMonitorSubject.subscribe(message => {
      this.setState({ serialMonitorContent: this.state.serialMonitorContent + message });
      scrollToBottom(serialTextarea);
    });
  }

  showError(err) {
    this.setState({ error: err });
  }

  clearError() {
    this.setState({ error: '' });
  }

  connect() {
    this.clearError();
    Daemon.findAgent()
      .catch(this.showError);
  }

  handleOpen(e, port) {
    this.setState({ serialMonitorContent: '' });
    e.preventDefault();
    Daemon.readerWriter.openSerialMonitor(port);
  }

  handleClose(e, port) {
    e.preventDefault();
    Daemon.readerWriter.closeSerialMonitor(port);
  }

  render() {
    const listSerialDevices = this.state.serialDevices.map((device, i) => (<li key={i}>{device.Name} - IsOpen: {device.IsOpen ? 'true' : 'false'} - <a href="#" onClick={(e) => this.handleOpen(e, device.Name)}>open</a> - <a href="#" onClick={(e) => this.handleClose(e, device.Name)}>close</a></li>));
    const listNetworkDevices = this.state.networkDevices.map((device, i) => <li key={i}>{device.Name}</li>);

    return (
      <div>
        <h1>Test Arduino Create Plugin</h1>
        <p>Agent status: <span id="agent-status" className={ this.state.agentStatus === AGENT_STATUS_FOUND ? 'found' : 'not-found' }>
          { this.state.agentStatus }
        </span></p>
        <pre id="agent-info">
          { this.state.agentInfo }
        </pre>
        <p>Web socket status: <span id="ws-status" className={ this.state.wsStatus === WS_STATUS_CONNECTED ? 'found' : 'not-found' }>
          { this.state.wsStatus }
        </span></p>
        <div>
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
        <button id="connect" onClick={ this.connect }>Connect</button>
        <div className="serial-monitor">
          <h2>Serial Monitor</h2>
          <textarea id="serial-textarea" value={ this.state.serialMonitorContent }/>
        </div>
      </div>
    );
  }
}

export default App;
