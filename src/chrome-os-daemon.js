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

import WebSerialDaemon from './web-serial-daemon';
import ChromeAppDaemon from './chrome-app-daemon';

/**
 * ChromeOSDaemon is a new implementation for ChromeOS which allows
 + to select the legacy Chrome app or the new BETA web serial API,
 * based on the the existance of a specific key in the browser CacheStorage,
 * which in turn means that the user has installed it from the Google Play Store
 *
 */
export default function ChromeOsDaemon(boardsUrl, options) {

  let useWebSerial = null;
  let chromeExtensionId;

  // check chromeExtensionId OR web serial API
  if (typeof options === 'string') {
    chromeExtensionId = options;
  }
  else {
    useWebSerial = options.useWebSerial;
    chromeExtensionId = options.chromeExtensionId;
  }
  if (useWebSerial === 'true' && 'serial' in navigator) {
    this.flavour = new WebSerialDaemon(boardsUrl);
  }
  else {
    this.flavour = new ChromeAppDaemon(boardsUrl, chromeExtensionId);
  }

  const handler = {
    get: (_, name) => this.flavour[name],

    set: (_, name, value) => {
      this.flavour[name] = value;
      return true;
    }
  };

  return new Proxy(this, handler);

}
