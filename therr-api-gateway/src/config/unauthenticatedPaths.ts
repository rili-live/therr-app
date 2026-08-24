/**
 * Paths that skip the `authenticate` middleware.
 *
 * Kept in its own module (rather than inline in index.ts) so the list is
 * unit-testable: importing index.ts starts an Express listener. Same reasoning as
 * therr-client-web's `habitsSubdomainRoutes.ts`.
 *
 * ## The trailing `$` is load-bearing
 *
 * `express-unless` matches each entry with a bare `RegExp.exec()` against
 * `url.pathname`. An unanchored pattern therefore matches any path that merely
 * *contains* it, including every sub-path beneath it. Skipping `authenticate` does
 * not make a route public in a useful way — it leaves `req['x-user-access-levels']`
 * unset, so a downstream `authorize()` reads an empty access-level list and rejects
 * even a SUPER_ADMIN with 403 "Invalid Access Levels".
 *
 * That is exactly what happened to `GET /users/:id/push-diagnostics`: the public
 * profile pattern swallowed it, making the endpoint unreachable for everyone.
 *
 * So: anchor every pattern that names a resource, with `\/?$` when a trailing slash
 * should still match. Leave a pattern open-ended only when the sub-tree genuinely is
 * public (e.g. the image proxy), and say so in a comment.
 */

export interface IUnauthenticatedPath {
    url: string | RegExp;
    methods: string[];
}

const UUID_RE_SRC = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const unauthenticatedPaths: IUnauthenticatedPath[] = [
    { url: '/', methods: ['GET'] }, // healthcheck
    { url: '/healthcheck', methods: ['GET'] }, // healthcheck
    { url: '/v1/docs', methods: ['GET'] }, // API documentation
    { url: '/v1/docs/openapi.json', methods: ['GET'] }, // OpenAPI spec
    // { url: '/favicon.ico', methods: ['GET'] }, // favicon
    { url: '/v1/users-service/interests', methods: ['GET'] },
    { url: '/v1/users-service/rewards/exchange-rate', methods: ['GET'] },
    { url: '/v1/users-service/emails/bounced', methods: ['POST'] }, // bounced email handler
    { url: '/v1/users-service/subscribers/signup', methods: ['POST'] }, // email marketing subscribe
    { url: '/v1/users-service/subscribers/preferences', methods: ['GET'] }, // Update E-mail subscription settings
    { url: '/v1/users-service/subscribers/unsubscribe', methods: ['POST'] }, // Update E-mail subscription settings
    { url: '/v1/users-service/subscribers/send-feedback', methods: ['POST'] }, // send feedback
    { url: '/v1/users-service/auth', methods: ['POST'] }, // login
    { url: '/v1/users-service/payments/webhook', methods: ['POST'] }, // webhook
    // Stripe Checkout. Pre-account by design: buy-then-register means the buyer may hold no
    // session when they start checkout, and none when Stripe returns them to
    // /payment-complete/:sessionId — a public route. Requiring a JWT 401s that visitor, and
    // the dashboard's 401 interceptor then logs them out and navigates to /login, off the very
    // page that fires the GA4 `purchase` event.
    //
    // Neither handler grants anything on the strength of being reached: `activateUserSubscription`
    // requires the session's Stripe billing email to match the account's before any access level
    // moves, and `createCheckoutSession` only mints a Stripe session. Both use authenticateOptional
    // (services/users/router.ts) so a signed-in buyer still arrives with x-userid, and both sit
    // behind serviceRateLimiter in routes/index.ts.
    { url: '/v1/users-service/payments/checkout/sessions', methods: ['POST'] }, // start checkout
    // ANCHORED to a single path segment so it cannot swallow a future sub-path under a session id.
    { url: /\/v1\/users-service\/payments\/checkout\/sessions\/[^/]+$/, methods: ['POST'] }, // activate a completed checkout
    { url: '/v1/users-service/users', methods: ['POST'] }, // register
    // Public profile by id. ANCHORED: unanchored, this also matched every sub-path under
    // /users/:id — which is what made /users/:id/push-diagnostics 403 for a SUPER_ADMIN.
    { url: new RegExp(`/v1/users-service/users/${UUID_RE_SRC}/?$`), methods: ['GET'] },
    // Public badges — handler enforces settingsIsProfilePublic
    { url: new RegExp(`/v1/users-service/users/achievements/${UUID_RE_SRC}/public$`), methods: ['GET'] },
    { url: '/v1/users-service/auth/token/refresh', methods: ['POST'] }, // token refresh
    { url: '/v1/users-service/auth/email-precheck', methods: ['POST'] }, // multi-app email lookup (enumeration-safe)
    { url: '/v1/users-service/auth/handoff/redeem', methods: ['POST'] }, // cross-app handoff: code IS the credential
    { url: '/v1/users-service/users/forgot-password', methods: ['POST'] }, // one time password
    // Passwordless phone auth. These are pre-session by definition: the SMS code IS the
    // credential, so requiring a JWT would make them unreachable. Each is rate limited
    // per IP and per phone number in services/phone/router.ts.
    { url: '/v1/phone/auth/start', methods: ['POST'] }, // SMS sign-in: request code
    { url: '/v1/phone/auth/verify', methods: ['POST'] }, // SMS sign-in: submit code
    { url: '/v1/phone/auth/select', methods: ['POST'] }, // SMS sign-in: pick account when a number has several
    { url: '/v1/phone/register/start', methods: ['POST'] }, // SMS sign-up: request code
    { url: '/v1/phone/register/verify', methods: ['POST'] }, // SMS sign-up: submit code
    { url: '/v1/users-service/social-sync/oauth2-tiktok', methods: ['GET'] }, // TikTok OAuth
    { url: '/v1/users-service/social-sync/oauth2-facebook', methods: ['GET'] }, // Facebook OAuth
    { url: '/v1/users-service/social-sync/oauth2-dashboard-facebook', methods: ['GET'] }, // Facebook OAuth
    { url: '/v1/users-service/social-sync/oauth2-instagram', methods: ['GET'] }, // Instagram OAuth
    { url: /\/v1\/users-service\/users\/verify\/.*/, methods: ['POST'] }, // verify account
    { url: /\/v1\/users-service\/users\/by-username\/.*/, methods: ['GET'] }, // Get public/private profile
    // Magic invite-link token lookup. Pre-signup by definition — the invitee has no
    // account yet, so requiring a JWT made the endpoint unreachable from the very
    // landing pages it exists for. Exposure is limited to whoever holds the
    // unguessable token, and the route is rate limited in services/users/router.ts.
    { url: new RegExp(`/v1/users-service/users/invites/${UUID_RE_SRC}$`, 'i'), methods: ['GET'] },
    { url: /\/v1\/user-files\/.*/, methods: ['GET'] }, // image proxy — whole sub-tree is public
    { url: /\/v1\/maps-service\/place\/*/, methods: ['GET'] }, // Google Maps: Places proxy
    { url: '/v1/maps-service/geocode', methods: ['GET'] }, // Nominatim geocoding proxy
    { url: /\/v1\/maps-service\/moments\/.*\/details/, methods: ['POST'] },
    { url: '/v1/maps-service/spaces/list', methods: ['POST'] },
    { url: /\/v1\/maps-service\/spaces\/.*\/details/, methods: ['POST'] },
    { url: /\/v1\/maps-service\/events\/.*\/details/, methods: ['POST'] }, // Public event view (uses authenticateOptional)
    { url: /\/v1\/maps-service\/events\/search/, methods: ['POST'] }, // Optional for public map view
    { url: /\/v1\/maps-service\/moments\/search/, methods: ['POST'] }, // Optional for public map view
    { url: /\/v1\/maps-service\/spaces\/search/, methods: ['POST'] }, // Optional for public map view
    { url: /\/v1\/maps-service\/spaces\/.*\/pairings$/, methods: ['GET'] }, // Space pairings (optional auth)
    { url: /\/v1\/maps-service\/spaces\/.*\/pairings\/feedback/, methods: ['POST'] }, // Pairing feedback (optional auth)
    { url: /\/v1\/maps-service\/spaces\/[^/]+\/corrections$/, methods: ['POST'] }, // Crowdsourced business info corrections (uses authenticateOptional)
    { url: /\/v1\/maps-service\/cities\/[^/]+\/pulse$/, methods: ['GET'] }, // Public city landing page (uses authenticateOptional)
    { url: /\/v1\/messages-service\/forums\/[0-9a-f-]+$/, methods: ['GET'] }, // Public group/forum view (uses authenticateOptional)
    { url: '/v1/messages-service/forums/search', methods: ['POST'] }, // Public forum search (uses authenticateOptional)
    { url: /\/v1\/reactions-service\/user-lists\/public\/[0-9a-f-]+\/[a-z0-9-]+$/, methods: ['GET'] }, // Public shareable list page
];

/**
 * Mirrors `express-unless`' own matching so callers and tests can ask the question
 * it actually answers: would `authenticate` be skipped for this request?
 *
 * This is a REIMPLEMENTATION — production calls `authenticate.unless()`, never this.
 * The two are held together by the "drift guardrail" block in
 * `tests/unit/config/unauthenticatedPaths.test.ts`, which runs the real middleware
 * over the real list and fails if the two ever disagree. Without it, a patch release
 * inside the `^0.5.0` range (or the 2.x rewrite, which changes the API) would leave
 * every test here green while the gateway authenticated a different set of routes.
 * If you change this function, that block is what proves you got it right.
 */
export const isUnauthenticatedPath = (pathname: string, method: string): boolean => unauthenticatedPaths.some((p) => {
    if (!p.methods.includes(method)) {
        return false;
    }
    if (typeof p.url === 'string') {
        return p.url === pathname;
    }
    // Copy without /g and /y rather than resetting lastIndex on the shared instance,
    // so repeated calls can't interfere with each other.
    return new RegExp(p.url.source, p.url.flags.replace(/[gy]/g, '')).test(pathname);
});

export default unauthenticatedPaths;
