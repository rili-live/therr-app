import * as React from 'react';
import LogRocket from 'logrocket';
import setupLogRocketReact from 'logrocket-react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import Layout from './components/Layout';
import store from './store';

// Third Party Styles
import 'react-phone-number-input/style.css';

// Therr Styles
// Change the following import to alter theme
// TODO: RSERV-8-: Use themes endpoint to dynamically load theme styles
import './styles/themes/retro/index.scss';

LogRocket.init('pibaqj/therr-web-app');
// after calling LogRocket.init()
setupLogRocketReact(LogRocket);

window.onload = () => {
    render(
        <Provider store={store}>
            <BrowserRouter>
                <Layout />
            </BrowserRouter>
        </Provider>,
        document.getElementById('app'),
    );
};
