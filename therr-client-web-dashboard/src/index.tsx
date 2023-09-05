import * as React from 'react';
import LogRocket from 'logrocket';
import setupLogRocketReact from 'logrocket-react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import store from './store';

// Third Party Styles
import 'react-phone-number-input/style.css';

// Brand Styles
// Change the following import to alter theme
// TODO: RSERV-8-: Use themes endpoint to dynamically load theme styles
// import './styles/themes/forest/index.scss';
import './styles/root.scss';

const rootEl = document.getElementById('app');
// const root = createRoot(rootEl);
const RootComponent = () => (
    <Provider store={store} serverState={store.preloadedState}>
        <BrowserRouter>
            <ScrollToTop />
            <Layout />
        </BrowserRouter>
    </Provider>
);

LogRocket.init('pibaqj/therr-web-app');
// after calling LogRocket.init()
setupLogRocketReact(LogRocket);
if (process.env.NODE_ENV === 'development') {
    createRoot(rootEl).render(<RootComponent />);
} else {
    hydrateRoot(
        rootEl,
        <RootComponent />,
    );
}
