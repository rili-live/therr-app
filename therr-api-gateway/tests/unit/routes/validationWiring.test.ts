/**
 * Every express-validator chain on a route should be followed by `validate`.
 *
 * A chain registered on its own still *runs* — it populates the request's error
 * bag and applies its sanitizers — but nothing reads that bag without
 * `validate`, so the route advertises a body contract it never enforces and
 * proxies the malformed request downstream. There is no runtime signal: the
 * route looks correct, the validators look correct, and the 400 simply never
 * fires.
 *
 * `PUT /users/change-password` shipped in exactly that state. It was invisible
 * for as long as `PUT /users/:id` shadowed the route (see routeOrdering.test.ts)
 * and would have gone live unenforced the moment the shadowing was fixed on
 * 2026-08-14 — which is why this is asserted across the whole gateway rather
 * than spot-checked on the one route that surfaced it.
 *
 * ## Why this is a baseline and not a zero gate
 *
 * Fourteen routes were already in this state when the check was written. They
 * are listed below rather than fixed, because enforcing a chain that has never
 * run is a live behavior change for clients that cannot be force-updated: a
 * deployed mobile app sending a body that quietly violated `POST /users/search`
 * starts getting a 400 the day the gate is closed. Each needs its own
 * payload-compatibility check against the shipped clients before `validate` is
 * added — tracked in docs/WORK_IN_PROGRESS.md.
 *
 * `change-password` was safe to fix immediately because it was not merely
 * unenforced, it was unreachable: `updateUserValidation` runs
 * `param('id').isUUID(4)` behind `validate`, so every request to it 400'd. No
 * client can depend on behavior that never worked.
 *
 * The list is a ratchet: adding to it should be deliberate, and removing from it
 * (by wiring `validate`) is always safe to do here.
 */
import { expect } from 'chai';
import { validate } from '../../../src/validation';

interface IUnenforcedRoute {
    method: string;
    path: string;
    chainCount: number;
}

/**
 * Routes that declare validators without `validate`, as of 2026-08-14. Keyed
 * `METHOD path` on the route's own path, without its service mount prefix.
 */
const KNOWN_UNENFORCED: string[] = [
    'PUT /forums/:forumId',
    'POST /users/connections',
    'POST /users/connections/multi-invite',
    'PUT /users/connections',
    'PUT /users/connections/type',
    'POST /users/search',
    'POST /users/search-pairings',
    'POST /users/forgot-password',
    'POST /users/verify/resend',
    'POST /users/verify/:token',
    'PUT /users/notifications/:notificationId',
    'POST /social-sync',
    'POST /subscribers/send-feedback',
    'POST /subscribers/signup',
];

/**
 * An express-validator chain is a middleware function that also exposes `.run`.
 * Plain middleware (authenticate, rate limiters, handleServiceRequest) does not,
 * so identity here is structural rather than a name match.
 */
const isValidationChain = (handle: any): boolean => typeof handle === 'function' && typeof handle?.run === 'function';

const toKey = ({ method, path }: IUnenforcedRoute): string => `${method} ${path}`;

const collectUnenforced = (router: any, out: IUnenforcedRoute[] = []): IUnenforcedRoute[] => {
    (router?.stack || []).forEach((layer: any) => {
        if (layer.route) {
            const handles = (layer.route.stack || []).map((entry: any) => entry.handle);
            const chainCount = handles.filter(isValidationChain).length;

            // Compared by reference, not by name: `validate` is a single shared
            // export, and a look-alike local wrapper should not satisfy this.
            if (chainCount > 0 && !handles.includes(validate)) {
                Object.keys(layer.route.methods || {})
                    .filter((method) => layer.route.methods[method])
                    .forEach((method) => out.push({
                        method: method.toUpperCase(),
                        path: layer.route.path,
                        chainCount,
                    }));
            }

            return;
        }

        if (layer.name === 'router' && layer.handle?.stack) {
            collectUnenforced(layer.handle, out);
        }
    });

    return out;
};

// Required lazily for the same reason as routeOrdering.test.ts: the service routers
// construct rate limiters and read config at module load.
// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
const getGatewayRouter = () => require('../../../src/routes').default;

describe('route validation wiring', () => {
    it('adds no new route that declares validators without `validate`', () => {
        const unenforced = collectUnenforced(getGatewayRouter());
        const added = unenforced.filter((route) => !KNOWN_UNENFORCED.includes(toKey(route)));

        const detail = added
            .map((route) => `  ${toKey(route)} declares ${route.chainCount} validator(s) but never calls validate`)
            .join('\n');

        expect(added, `\nAdd \`validate\` after the chain, or justify an entry in KNOWN_UNENFORCED:\n${detail}\n`)
            .to.have.lengthOf(0);
    });

    it('keeps the baseline honest — every KNOWN_UNENFORCED entry still exists and is still unenforced', () => {
        // Without this the list would rot into a set of stale strings that silently
        // re-admit a route after someone renames it.
        const present = collectUnenforced(getGatewayRouter()).map(toKey);
        const stale = KNOWN_UNENFORCED.filter((key) => !present.includes(key));

        expect(stale, `\nThese are fixed or gone — delete them from KNOWN_UNENFORCED:\n  ${stale.join('\n  ')}\n`)
            .to.have.lengthOf(0);
    });

    it('enforces the change-password body contract', () => {
        // The specific regression: this route was unreachable, so its four required
        // fields were never checked. Un-shadowing it without `validate` would have
        // proxied any body straight through to the users-service.
        const unenforced = collectUnenforced(getGatewayRouter()).map(toKey);

        expect(unenforced).to.not.include('PUT /users/change-password');
    });

    it('recognizes a validator chain that is not followed by validate', () => {
        // Guards the detector itself — without this, the assertions above would keep
        // passing if `isValidationChain` ever stopped matching anything.
        // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
        const express = require('express');
        // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
        const { body } = require('express-validator');
        const noop = (req: any, res: any) => res.end();

        const router = express.Router();
        router.put('/enforced', [body('a').exists()], validate, noop);
        router.put('/unenforced', [body('a').exists()], noop);

        const unenforced = collectUnenforced(router);

        expect(unenforced).to.have.lengthOf(1);
        expect(unenforced[0].path).to.eq('/unenforced');
        expect(unenforced[0].chainCount).to.eq(1);
    });
});
