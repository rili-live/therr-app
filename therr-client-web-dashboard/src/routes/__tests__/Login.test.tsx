/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { LoginComponent } from '../Login';

// The socket middleware connects at import time and needs env config this suite doesn't load
jest.mock('../../socket-io-middleware', () => ({
    socketIO: { on: () => {}, emit: () => {} },
}));

const renderLogin = (search = '') => renderToStaticMarkup(
    <StaticRouter location={search ? `/login${search}` : '/login'}>
        {React.createElement(LoginComponent as any, {
            location: { search },
            navigation: { navigate: () => {} },
            login: () => Promise.resolve(),
            user: { isAuthenticated: false, details: {} },
        })}
    </StaticRouter>,
);

describe('Login', () => {
    it('explains the product to unauthenticated visitors who were redirected here', () => {
        const markup = renderLogin();

        expect(markup).toContain('Local marketing, all in one place');
        expect(markup).toContain('Claim your business space');
        expect(markup).toContain('Creating an account is free');
    });

    it('renders a create-account call to action', () => {
        const markup = renderLogin();

        expect(markup).toContain('Create a free account');
        expect(markup).toContain('href="/register"');
    });

    it('preserves returnTo on the create-account call to action', () => {
        const markup = renderLogin('?returnTo=%2Fsettings%2Fapi-keys');

        expect(markup).toContain('href="/register?returnTo=%2Fsettings%2Fapi-keys"');
    });
});
