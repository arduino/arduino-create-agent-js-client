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

import SocketDaemon from './socket-daemon';
import ChromeOsDaemon from './chrome-app-daemon';
import WebSerialDaemon from './web-serial-daemon';
import FirmwareUpdater from './firmware-updater';

// eslint-disable-next-line import/no-mutable-exports
let Daemon;

if (window.navigator.userAgent.indexOf(' CrOS ') !== -1) {
  if (navigator.serial) {
    Daemon = WebSerialDaemon;
  }
  else {
    Daemon = ChromeOsDaemon;
  }
}
else {
  Daemon = SocketDaemon;
}

export default Daemon;
export { FirmwareUpdater };
