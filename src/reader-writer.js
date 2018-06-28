export default class ReaderWriter {
  constructor(socket, pluginUrl, devicesListStatus) {
    this.socket = socket;
    this.pluginUrl = pluginUrl;
    this.devicesListStatus = devicesListStatus;
    this.socket.on('message', this.parseMessage.bind(this));
  }

  initSocket(socket) {
    this.socket = socket;
  }

  initPluginUrl(pluginUrl) {
    this.pluginURL = pluginUrl;
  }

  parseMessage(message) {
    let jsonMessage;

    try {
      jsonMessage = JSON.parse(message);
    }
    catch (SyntaxError) {
      return;
    }

    if (jsonMessage) {
      // Result of a list command
      if (jsonMessage.Ports) {
        this.devicesListStatus.next(jsonMessage);
      }
    }
  }
}
