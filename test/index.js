import Daemon from '../src';
import { WS_STATUS_CONNECTED, AGENT_STATUS_FOUND } from '../src/socket-daemon';

function showError(error) {
  document.getElementById('error').innerText = error.message;
}

function clearError() {
  document.getElementById('error').innerText = '';
}

Daemon.agentDiscoveryStatus.subscribe(status => {
  document.getElementById('agent-status').style.color = status === AGENT_STATUS_FOUND ? 'green' : 'red';
  document.getElementById('agent-status').innerText = status;
  document.getElementById('agent-info').innerHTML = JSON.stringify(Daemon.agentInfo, null, 2);
});

Daemon.wsConnectionStatus.subscribe(status => {
  document.getElementById('ws-status').style.color = status === WS_STATUS_CONNECTED ? 'green' : 'red';
  document.getElementById('ws-status').innerText = status;
});

Daemon.wsError.subscribe(showError);

document.getElementById('connect').addEventListener('click', () => {
  // document.getElementById('agent-status').innerText = '-';
  // document.getElementById('agent-status').style.color = null;
  // document.getElementById('agent-info').innerHTML = '';
  // document.getElementById('ws-status').innerText = '-';
  // document.getElementById('ws-status').style.color = null;
  clearError();
  Daemon.findAgent()
    .catch(showError);
});

Daemon.readerWriter.messageSubject.subscribe(devicesInfo => {
  document.getElementById('boards-list').innerHTML = JSON.stringify(devicesInfo, null, 2);
});
