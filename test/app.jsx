import React from 'react';
import Daemon from '../src';
import { WS_STATUS_CONNECTED, AGENT_STATUS_FOUND } from '../src/socket-daemon';

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      error: '',
      agentStatus: '-',
      wsStatus: '-',
      serialDevices: [],
      networkDevices: [],
      agentInfo: ''
    };
    this.connect = this.connect.bind(this);
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

  render() {
    const listSerialDevices = this.state.serialDevices.map(device => <li>{device.Name}</li>);
    const listNetworkDevices = this.state.networkDevices.map(device => <li>{device.Name}</li>);

    return (
      <div>
        <h1>Test Daemon</h1>
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
      </div>
    );
  }
}

export default App;
