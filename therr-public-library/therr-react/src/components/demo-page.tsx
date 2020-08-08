import * as React from 'react';
import * as ReactDOM from 'react-dom';
import 'therr-styles/index.scss'; // eslint-disable-line

// NOTE: Order matters for these css files
// ...the latter will overwrite the former
import '../styles/demo-page.scss';

ReactDOM.render(
    <div>
        <h1>Therr Public Library: React Components</h1>
        <h2>Demo Page</h2>
    </div>,
    document.getElementById('app'),
);
