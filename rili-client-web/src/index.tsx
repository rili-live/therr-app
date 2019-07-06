import * as React from 'react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import Layout from './components/Layout';
import store from './store';
// Change the following import to alter theme
// TODO: RSERV-8-: Use themes endpoint to dynamically load theme styles
import './styles/themes/mothers-day/index.scss';

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