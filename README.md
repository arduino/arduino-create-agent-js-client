# create-plugin-communication
JS module providing discovery of the Arduino Create Plugin and communication with it

## Installation

```bash
npm install create-plugin-communication --save
```

## How to use

```js
import Daemon from 'create-plugin-communication';

const daemon = new Daemon();

daemon.agentFound.subscribe(status => {
  // true / false
});

daemon.channelOpen.subscribe(status => {
  // true / false
});

daemon.error.subscribe(err => {
  // handle err
});

// List available devices (serial/network)
daemon.devicesList.subscribe(devices => {
  const  serialDevices = devices.serial;
  const  networkDevices = devices.network;
});

// Open serial monitor
daemon.openSerialMonitor('port-name');

// Read from serial monitor
daemon.serialMonitorMessages.subscribe(message => {
  console.log(message);
});

// Write to serial monitor
daemon.writeSerial('port-name', 'message');

// Close serial monitor
daemon.closeSerialMonitor('port-name');

```
## Development
Just run `npm run dev` and open your browser on http://localhost:8000

## Agent communication

To enable communication between your [local installation](http://localhost:8000/) and the [Arduino Create Agent](https://github.com/arduino/arduino-create-agent)
add `origins = http://localhost:8000` on your agent config.ini file
(if you are using https, add `origins = https://localhost:8000`).

- On macOs ~/Applications/ArduinoCreateAgent-1.1/ArduinoCreateAgent.app/Contents/MacOS/config.ini
- On Linux ~/ArduinoCreateAgent-1.1/config.ini
