# create-plugin-communication
JS module providing discovery of the Arduino Create Plugin and communication with it

## Installation

```bash
npm install create-plugin-communication --save
```

## How to use

```js
import Daemon from 'create-plugin-communication';ù

// Ask for agent connection
Daemon.findAgent()

Daemon.agentDiscoveryStatus.subscribe(status => {
  // AGENT_FOUND / AGENT_NOT_FOUND
});

Daemon.wsConnectionStatus.subscribe(status => {
  // WS_CONNECTED / WS_DISCONNECTED
});

Daemon.wsError.subscribe(err => {
  // handle err
});

Daemon.readerWriter.messageSubject.subscribe(() => {
  const  serialDevices = Daemon.readerWriter.devicesList.serial;
  const  networkDevices = Daemon.readerWriter.devicesList.network;
});
```
## Development
Just run `npm run dev` and open your browser on http://localhost:8000

## Agent communication

To enable communication between your [local installation](http://localhost:8000/) and the [Arduino Create Agent](https://github.com/arduino/arduino-create-agent)
add `origins = http://localhost:8000` on your agent config.ini file (if you are using https, add `origins = https://localhost:8000`).

- On macOs ~/Applications/ArduinoCreateAgent-1.1/ArduinoCreateAgent.app/Contents/MacOS/config.ini
- On Linux ~/ArduinoCreateAgent-1.1/config.ini
