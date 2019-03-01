import React from 'react';

class V2 extends React.Component {
  constructor() {
    super();
    this.state = {
      tools: []
    };

  }

  componentDidMount() {
    this.daemon = this.props.daemon;

    this.daemon.agentV2Found.subscribe(daemonV2 => {
      if (!daemonV2) {
        return;
      }
      this.daemonV2 = daemonV2;
      this.daemonV2.installedTools().then(res => {
        this.setState({
          tools: res
        });
      });
    })
  }

  render() {
    const tools = this.state.tools.map((tool, i) =>
      <tr>
        <td>{tool.packager}</td>
        <td>{tool.name}</td>
        <td>{tool.version}</td>
      </tr>);

    return (
      <section>
        <h2>V2</h2>
        <section>
          <h3>Installed tools</h3>
          <table>
            <tr>
              <th>Packager</th>
              <th>Name</th>
              <th>Version</th>
            </tr>
            {tools}
          </table>
        </section>
      </section >
    )
  }
}

export default V2;
