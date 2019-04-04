import React from 'react';
import { flatMap } from 'rxjs/operators';

export class V2InstallTool extends React.Component {
  constructor() {
    super();
    this.state = {
      name: 'avrdude',
      version: '6.3.0-arduino9',
      packager: 'arduino',
      url: 'http://downloads.arduino.cc/tools/avrdude-6.3.0-arduino9-i686-w64-mingw32.zip',
      checksum: 'SHA-256:f3c5cfa8d0b3b0caee81c5b35fb6acff89c342ef609bf4266734c6266a256d4f',
      signature: '7628b488c7ffd21ae1ca657245751a4043c419fbab5c256a020fb53f17eb88686439f54f18e78a80b40fc2de742f79b78ed4338c959216dc8ae8279e482d2d4117eeaf34a281ce2369d1dc4356f782c0940d82610f1c892e913b637391c39e95d4d4dfe82d8dbc5350b833186a70a62c7952917481bad798a9c8b4905df91bd914fbdfd6e98ef75c8f7fb06284278da449ce05b27741d6eda156bbdb906d519ff7d7d5042379fdfc55962b3777fb9240b368552182758c297e39c72943d75d177f2dbb584b2210301250796dbe8af11f0cf06d762fe4f912294f4cdc8aff26715354cfb33010a81342fbbc438912eb424a39fc0c52a9b2bf722051a6f3b024bd',
      res: ''
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  componentDidMount() {
    this.daemon = this.props.daemon;

    this.daemon.agentV2Found.subscribe(daemonV2 => {
      if (!daemonV2) {
        return;
      }
      this.daemonV2 = daemonV2;
    });
  }

  handleChange(event) {
    this.setState({ [event.target.name]: event.target.value });
  }

  handleSubmit(event) {
    event.preventDefault();

    this.daemonV2.installTool({
      name: this.state.name,
      version: this.state.version,
      packager: this.state.packager,
      checksum: this.state.checksum,
      signature: this.state.signature,
      url: this.state.url,

    })
      .then(res => {
        this.setState({
          res: JSON.stringify(res, null, 2)
        });
      })
      .catch(err => {
        this.setState({
          res: JSON.stringify(err, null, 2)
        });
      });
  }

  render() {
    return (
      <section className="install-tool-container">
        <h2>Install a new tool</h2>
        <form onSubmit={this.handleSubmit}>
          <div className="tool-input">
            <label for="name">
              Name:
            </label>
            <input type="text" name="name" value={this.state.name} onChange={this.handleChange} />
          </div>
          <div className="tool-input">
            <label for="version">
              Version:
            </label>
            <input type="text" name="version" value={this.state.version} onChange={this.handleChange} />
          </div>
          <div className="tool-input">
            <label for="packager">
              Packager:
            </label>
            <input type="text" name="packager" value={this.state.packager} onChange={this.handleChange} />
          </div>
          <div className="tool-input">
            <label for="url">
              Url:
            </label>
            <input type="text" name="url" value={this.state.url} onChange={this.handleChange} />
          </div>
          <div className="tool-input">
            <label for="checksum">
              Checksum:
            </label>
            <input type="text" name="checksum" value={this.state.checksum} onChange={this.handleChange} />
          </div>
          <div className="tool-input">
            <label for="signature">
              Signature:
            </label>
            <input type="text" name="signature" value={this.state.signature} onChange={this.handleChange} />
          </div>
          <input type="submit" value="Submit" />
        </form>
        <textarea cols="100" rows="10" value={this.state.res} readOnly></textarea>
      </section>
    );
  }
}
