import * as React from 'react';
import * as ReactDOM from 'react-dom';
import 'rili-public-library/styles/index.scss'; //tslint:disable-line:no-implicit-dependencies

// NOTE: Order matters for these css files
// ...the latter will overwrite the former
import '../styles/demo-page.scss';

ReactDOM.render(
    <div>
        <h1>Rili Public Library: React Components</h1>
        <h2>Demo Page</h2>
    </div>,
    document.getElementById('app'),
);
