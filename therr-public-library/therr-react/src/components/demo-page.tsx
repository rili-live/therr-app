import * as React from 'react';
import { createRoot } from 'react-dom/client';
import 'therr-styles/index.scss'; // eslint-disable-line

// NOTE: Order matters for these css files
// ...the latter will overwrite the former
import '../styles/demo-page.scss';

const container = document.getElementById('app');
const root = createRoot(container!);

const Component = () => (
    <div>
        <h1>Therr Public Library: React Components</h1>
        <h2>Demo Page</h2>
    </div>
);

root.render(<Component />);
