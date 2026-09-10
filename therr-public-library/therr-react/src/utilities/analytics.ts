/**
 * Shared GA4 configuration for the web clients.
 *
 * Deliberately holds no `react-ga4` import — it returns plain option objects
 * that each client passes to its own `ReactGA.initialize`. therr-react is also
 * consumed by TherrMobile, which has its own package.json and uses Firebase
 * Analytics, so a hard dependency on a web-only analytics library does not
 * belong in this package.
 */

import { AttributionSurface } from './attribution';

/**
 * Registrable domains the GA4 linker decorates outbound links for.
 *
 * therr.app and therr.com are *different registrable domains*, so a visitor
 * crossing between them starts a new session attributed to
 * `therr.com / referral` and the original campaign is lost. Cross-domain
 * measurement is what carries `_gl` across that hop. Subdomains
 * (dashboard., business., habits.) are covered by the registrable domain.
 *
 * The linker only works when the *receiving* property also accepts the
 * parameter, which is why `accept_incoming` is set on every client. It must
 * additionally be configured in the GA4 admin UI (Data Streams → Configure tag
 * settings → Configure your domains) — the tag-side config alone decorates
 * links but does not make the destination property honour them.
 */
export const CROSS_DOMAIN_LINKER_DOMAINS = ['therr.app', 'therr.com'];

/**
 * Options for `ReactGA.initialize(measurementId, getGa4InitOptions(surface))`.
 *
 * `surface` is sent as a custom dimension on every hit so the three clients
 * stay separable once they report into one consolidated property. Register it
 * as a custom dimension in GA4 admin (scope: event, parameter: `surface`) or
 * it will be collected but not reportable.
 */
export const getGa4InitOptions = (surface: AttributionSurface) => ({
    gtagOptions: {
        linker: {
            domains: CROSS_DOMAIN_LINKER_DOMAINS,
            accept_incoming: true,
        },
        surface,
    },
});

interface IAnalyticsEnvVars {
    googleAnalyticsKey?: string;
    googleAnalyticsKeyDashboard?: string;
    googleAnalyticsKeyUnified?: string;
}

/**
 * Which GA4 properties this surface reports into.
 *
 * The funnel currently spans three separate properties (therr.app, therr.com,
 * dashboard.therr.com), so it cannot be expressed as a single
 * `run_funnel_report` at all. Consolidating means creating a *new* property —
 * GA4 cannot backfill history across properties, so the old ones have to keep
 * running in parallel while the new one accumulates a usable window.
 *
 * That parallel run is what the array return is for: `ReactGA.initialize`
 * accepts several measurement ids and sends every hit to all of them (it
 * applies each entry's own `gtagOptions`, so `surface` and the linker config
 * reach both properties). Set `googleAnalyticsKeyUnified` in global-config and
 * both properties collect from the next deploy; delete it again to roll back.
 * While it is unset this returns exactly the one property the surface used
 * before.
 *
 * **Callers must skip `initialize` when this is empty.** react-ga4 guards
 * against a falsy id but not an empty array — `[]` passes its check and then
 * throws on `initConfigs[0].trackingId`, which in a `componentDidMount` takes
 * the whole app down. An analytics misconfiguration must never do that, so the
 * emptiness check lives at each call site.
 */
export const getGa4Configs = (envVars: IAnalyticsEnvVars, surface: AttributionSurface) => {
    const existingKey = surface === 'dashboard'
        ? envVars.googleAnalyticsKeyDashboard
        : envVars.googleAnalyticsKey;

    const measurementIds = [envVars.googleAnalyticsKeyUnified, existingKey].filter(Boolean) as string[];

    return measurementIds.map((trackingId) => ({
        trackingId,
        ...getGa4InitOptions(surface),
    }));
};
