import * as React from 'react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import Layout from './components/layout';
import store from './store';
// Change the following import to alter theme
// TODO: RFRONT-: Configure webpack to compile all themes and allow client
// to select the css file that gets loaded
import './styles/themes/primary/index.scss';

window.onload = () => {
    render(
        <Provider store={store}>
            <BrowserRouter>
                <Layout />
            </BrowserRouter>
        </Provider>,
        document.getElementById('app')
    );
};