import React from 'react';
import { flatMap } from 'rxjs/operators';

export class V2InstallTool extends React.Component {
  constructor() {
    super();
    this.state = {
      name: "",
      version: "",
      packager: "",
      url: "",
      checksum: "",
      signature: "",
      res: ""
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
    })
  }

  handleChange(event) {
    this.setState({ [event.target.name]: event.target.value });
  }

  handleSubmit(event) {
    event.preventDefault();

    console.debug(this.state)

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
      <section>
        <h2>Install a new tool</h2>
        <form onSubmit={this.handleSubmit}>
          <label>
            Name:
          <input type="text" name="name" value={this.state.name} onChange={this.handleChange} />
          </label><br />
          <label>
            Version:
          <input type="text" name="version" value={this.state.version} onChange={this.handleChange} />
          </label> <br />
          <label>
            Packager:
          <input type="text" name="packager" value={this.state.packager} onChange={this.handleChange} />
          </label> <br />
          <label>
            Url:
          <input type="text" name="url" value={this.state.url} onChange={this.handleChange} />
          </label> <br />
          <label>
            Checksum:
          <input type="text" name="checksum" value={this.state.checksum} onChange={this.handleChange} />
          </label> <br />
          <label>
            Signature:
          <input type="text" name="signature" value={this.state.signature} onChange={this.handleChange} />
          </label> <br />
          <input type="submit" value="Submit" />
        </form>
        <textarea cols="100" rows="10" value={this.state.res} readOnly></textarea>
      </section>
    )
  }
}