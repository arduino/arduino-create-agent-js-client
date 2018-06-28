# create-plugin-communication
JS module providing discovery of the Arduino Create Plugin and communication with it

## Development
Just run `npm run dev` and open your browser on http://local.arduino.cc:8000

## Agent communication

To enable communication between your [local installation](http://local.arduino.cc:8000/) and the [Arduino Create Agent](https://github.com/arduino/arduino-create-agent)
add `origins = http://local.arduino.cc:8000` on your agent config.ini file (if you are using https, add `origins = https://local.arduino.cc:8000`).

- On macOs ~/Applications/ArduinoCreateAgent-1.1/ArduinoCreateAgent.app/Contents/MacOS/config.ini
- On Linux ~/ArduinoCreateAgent-1.1/config.ini
