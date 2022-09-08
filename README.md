[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![npm version](https://badge.fury.io/js/arduino-create-agent-js-client.svg)](https://badge.fury.io/js/arduino-create-agent-js-client)

# arduino-create-agent-js-client
JS module providing discovery of the [Arduino Create Agent](https://github.com/arduino/arduino-create-agent) and communication with it

## Changelog
See [CHANGELOG.md](https://github.com/arduino/arduino-create-agent-js-client/blob/HEAD/CHANGELOG.md) for more details.

## Installation

```bash
npm install arduino-create-agent-js-client --save
```

## How to use

```js
import Daemon from 'arduino-create-agent-js-client';

const daemon = new Daemon('https://builder.arduino.cc/v3/boards');

daemon.agentFound.subscribe(status => {
  // true / false
});

daemon.channelOpenStatus.subscribe(status => {
  // true / false
});

daemon.error.subscribe(err => {
  // handle err
});

// List available devices (serial/network)
daemon.devicesList.subscribe(({serial, network}) => {
  const  serialDevices = serial;
  const  networkDevices = network;
});

// Open serial monitor
daemon.openSerialMonitor('port-name');

// Read from serial monitor (ouputs string)
daemon.serialMonitorMessages.subscribe(message => {
  console.log(message);
});

// Read from serial monitor, output object with source port name
/*
  {
    "P": "dev/ttyACM0",
    "D":"output text here\r\n"
  }
*/
daemon.serialMonitorMessagesWithPort.subscribe(messageObj => {
  console.log(messageObj);
});

// Write to serial monitor
daemon.writeSerial('port-name', 'message');

// Close serial monitor
daemon.closeSerialMonitor('port-name');

// Upload sketch on serial target (desktop agent and chrome app)
daemon.uploadSerial(target, sketchName, compilationResult, verbose);

// Upload sketch on network target (daesktop agent only)
daemon.uploadNetwork(target, sketchName, compilationResult);

// Upload progress
daemon.uploading.subscribe(upload => {
  console.log(status);
});

// Download tool
daemon.downloadTool('toolname', 'toolversion' 'packageName', 'replacement');

// Download status
daemon.downloading.subscribe(download => {
  console.log(download);
});

```

## Version 2

Version 2 of the arduino-create-agent aims to provide a cleaner api based on promises.
It will remain confined to a v2 property on the daemon object until it will be stable.
At the moment it only supports tool management.

```js
daemon.agentV2Found.subscribe(daemonV2 => {
  if (!daemonV2) {
    // Your Agent doesn't support v2
  }
  // Your Agent supports v2
});

daemon.v2.installedTools()
  .then(tools => console.debug(tools)) // [{"name":"avrdude","version":"6.3.0-arduino9","packager":"arduino"}]

let payload = {
  name: 'avrdude',
  version: '6.3.0-arduino9',
  packager: 'arduino',
  url: 'http://downloads.arduino.cc/tools/avrdude-6.3.0-arduino9-i686-w64-mingw32.zip',
  checksum: 'SHA-256:f3c5cfa8d0b3b0caee81c5b35fb6acff89c342ef609bf4266734c6266a256d4f',
  signature: '7628b488c7ffd21ae1ca657245751a4043c419fbab5c256a020fb53f17eb88686439f54f18e78a80b40fc2de742f79b78ed4338c959216dc8ae8279e482d2d4117eeaf34a281ce2369d1dc4356f782c0940d82610f1c892e913b637391c39e95d4d4dfe82d8dbc5350b833186a70a62c7952917481bad798a9c8b4905df91bd914fbdfd6e98ef75c8f7fb06284278da449ce05b27741d6eda156bbdb906d519ff7d7d5042379fdfc55962b3777fb9240b368552182758c297e39c72943d75d177f2dbb584b2210301250796dbe8af11f0cf06d762fe4f912294f4cdc8aff26715354cfb33010a81342fbbc438912eb424a39fc0c52a9b2bf722051a6f3b024bd'
}
daemon.v2.installTool(payload) // Will install the tool in the system
```

## Development and test features
Just run `npm run dev` and open your browser on http://localhost:8000

## Agent communication

To enable communication between your [local installation](http://localhost:8000/) and the [Arduino Create Agent](https://github.com/arduino/arduino-create-agent)
add `origins = http://localhost:8000` on your agent config.ini file
(if you are using https, add `origins = https://localhost:8000`).

- On macOs ~/Applications/ArduinoCreateAgent/ArduinoCreateAgent.app/Contents/MacOS/config.ini
- On Linux ~/ArduinoCreateAgent/config.ini
- On Windows C:\Users\\[your user]\AppData\Roaming\ArduinoCreateAgent
