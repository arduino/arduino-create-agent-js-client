import React from 'react';
import ReactDOM from 'react-dom';

import App from './app.jsx';

// Mounts the App component into the <div id="root" /> element in the index.html
ReactDOM.render(React.createElement(App, null, null), document.getElementById('root'));
