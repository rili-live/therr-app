import * as React from 'react';
import LogRocket from 'logrocket';
import setupLogRocketReact from 'logrocket-react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import store from './store';
import mantineTheme from './styles/mantine-theme';
import * as globalConfig from '../../global-config';

// Third Party Styles
import '@mantine/core/styles.css';
import 'react-phone-number-input/style.css';

// Therr Styles
// CSS custom properties for runtime light/dark switching
import './styles/themes/css-variables.scss';
// Change the following import to alter theme
// TODO: RSERV-8-: Use themes endpoint to dynamically load theme styles
import './styles/themes/light/index.scss';

const rootEl = document.getElementById('app');
// const root = createRoot(rootEl);
const getColorScheme = (): 'light' | 'dark' => {
    const match = document.cookie.match(/therr-color-scheme=(light|dark)/);
    return (match?.[1] as 'light' | 'dark') || 'light';
};

// Detect locale prefix from URL for BrowserRouter basename
const getLocaleBasename = (): string | undefined => {
    const match = window.location.pathname.match(/^\/(es|fr)(\/|$)/);
    return match ? `/${match[1]}` : undefined;
};
const localeBasename = getLocaleBasename();

const envVars = globalConfig[process.env.NODE_ENV] || globalConfig.production;

const RootComponent = () => (
    <GoogleOAuthProvider clientId={envVars.googleOAuth2WebClientId}>
        <MantineProvider theme={mantineTheme} defaultColorScheme={getColorScheme()}>
            <Provider store={store} serverState={store.preloadedState}>
                <BrowserRouter basename={localeBasename}>
                    <ScrollToTop />
                    <Layout />
                </BrowserRouter>
            </Provider>
        </MantineProvider>
    </GoogleOAuthProvider>
);

if (process.env.NODE_ENV === 'development') {
    createRoot(rootEl).render(<RootComponent />);
} else {
    hydrateRoot(
        rootEl,
        <RootComponent />,
    );
}

// Defer LogRocket initialization to reduce main thread blocking during page load
requestIdleCallback(() => {
    LogRocket.init('pibaqj/therr-web-app');
    setupLogRocketReact(LogRocket);
}, { timeout: 5000 });
