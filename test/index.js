/*
* Copyright 2018 ARDUINO AG (http://www.arduino.cc/)
* This file is part of create-plugin-communication.
* Copyright (c) 2018
* Authors: Alberto Iannaccone, Stefania Mellai, Gabriele Destefanis
*
* This software is released under:
* The GNU General Public License, which covers the main part of
* create-plugin-communication
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

import React from 'react';
import ReactDOM from 'react-dom';

import App from './app.jsx';

// Mounts the App component into the <div id="root" /> element in the index.html
ReactDOM.render(React.createElement(App, null, null), document.getElementById('root'));
