export default class SocketDaemonV2 {
  constructor(daemonURL) {
    this.daemonURL = daemonURL + '/v2';
  }

  // installedTools uses the new v2 apis to ask the daemon a list of the tools already present in the system
  installedTools() {
    return fetch(`${this.daemonURL}/pkgs/tools/installed`, {
      method: 'GET',
    }).then(res => {
      return res.json();
    })
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
      method: 'PUT',
      body: JSON.stringify(payload)
    })
      .then(this.handleResponse);
  }

  handleResponse(response) {
    return response.json()
      .then((json) => {
        if (!response.ok) {
          const error = Object.assign({}, json, {
            status: response.status,
            statusText: response.statusText,
          });

          return Promise.reject(error);
        }
        return json;
      });
  }

}