import React from 'react';
import Daemon from '../src';

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
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
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
    this.daemon.serialMonitor.subscribe(message => {
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

  handleOpen(e, port) {
    this.setState({ serialMonitorContent: '' });
    e.preventDefault();
    this.daemon.openSerialMonitor(port);
  }

  handleClose(e, port) {
    e.preventDefault();
    this.daemon.closeSerialMonitor(port);
  }

  render() {
    const listSerialDevices = this.state.serialDevices.map((device, i) => (<li key={i}>{device.Name} - IsOpen: {device.IsOpen ? 'true' : 'false'} - <a href="#" onClick={(e) => this.handleOpen(e, device.Name)}>open</a> - <a href="#" onClick={(e) => this.handleClose(e, device.Name)}>close</a></li>));
    const listNetworkDevices = this.state.networkDevices.map((device, i) => <li key={i}>{device.Name}</li>);

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
        <div className="serial-monitor">
          <h2>Serial Monitor</h2>
          <textarea id="serial-textarea" value={ this.state.serialMonitorContent }/>
        </div>
      </div>
    );
  }
}

export default App;
