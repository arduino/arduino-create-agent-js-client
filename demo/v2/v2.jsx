import React from 'react';

class V2 extends React.Component {
    constructor() {
        super();
        this.state = {
            indexes: []
        };

        console.debug(this)
    }
    render() {
        const indexes = this.state.indexes.map((index, i) =>
        <li key={i}>
          {index}
        </li>);

        return (
            <section>
                <h2>V2</h2>
                <section>
                    <h3>Indexes</h3>
                    <ul>
                        { indexes }
                    </ul>
                </section>
            </section>
        )
    }
}

export default V2;
