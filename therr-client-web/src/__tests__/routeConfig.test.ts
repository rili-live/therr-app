/**
 * @jest-environment jsdom
 */

import routeConfig from '../routeConfig';

describe('routeConfig', () => {
    // routeConfig is not just SEO metadata — server-client.tsx registers one Express
    // handler per entry (`routeConfig.forEach(... app.get(routePath) ...)`) and there
    // is no catch-all route. A client route declared in routes/index.tsx but missing
    // here is unreachable on a hard load: Express 404s before React ever boots.
    const routes = routeConfig.map((config) => config.route);

    describe('token-landing routes reachable on a hard load', () => {
        // Regression: /invite/link/:token is the URL embedded in every invite email
        // and SMS. It was added to routes/index.tsx but not here, so every magic
        // invite link 404'd on web. '/invite/:username' does not cover it — an
        // Express :param matches a single segment and will not span the extra '/'.
        it('registers the magic invite-link landing', () => {
            expect(routes).toContain('/invite/link/:token');
        });

        it('registers the pact-claim landing', () => {
            expect(routes).toContain('/claim-pact/:token');
        });
    });

    it('gives every route a title and description for SSR head tags', () => {
        const missingHead = routeConfig
            .filter((config) => !config.head?.title || !config.head?.description)
            .map((config) => config.route);

        expect(missingHead).toEqual([]);
    });

    it('declares no duplicate routes (a later entry would shadow an earlier handler)', () => {
        expect(routes).toHaveLength(new Set(routes).size);
    });
});
