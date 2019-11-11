export default class SocketDaemonV2 {
  constructor(daemonURL) {
    this.daemonURL = `${daemonURL}/v2`;
  }

  // init tries an HEAD
  init() {
    return fetch(`${this.daemonURL}/pkgs/tools/installed`, {
      method: 'HEAD',
    }).then(res => {
      if (res.status !== 200) {
        throw Error('v2 not available');
      }
      return res;
    });
  }

  // installedTools uses the new v2 apis to ask the daemon a list of the tools already present in the system
  installedTools() {
    return fetch(`${this.daemonURL}/pkgs/tools/installed`, {
      method: 'GET',
    }).then(res => res.json());
  }

  // installTool uses the new v2 apis to ask the daemon to download a specific tool on the system
  // The expected payload is
  // {
  //   "name": "avrdude",
  //   "version": "6.3.0-arduino9",
  //   "packager": "arduino",
  //   "url": "https://downloads.arduino.cc/...", // system-specific package containing the tool
  //   "signature": "e7Gh8309...",  // proof that the url comes from a trusted source
  //   "checksum": "SHA256:90384nhfoso8..." // proof that the package wasn't tampered with
  // }
  installTool(payload) {
    return fetch(`${this.daemonURL}/pkgs/tools/installed`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(res => res.json()
      .then((json) => {
        if (!res.ok) {
          const error = {
            ...json,
            status: res.status,
            statusText: res.statusText,
          };
          return Promise.reject(error);
        }
        return json;
      }));
  }
}
