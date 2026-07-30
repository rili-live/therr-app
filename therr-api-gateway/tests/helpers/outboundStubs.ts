/**
 * Test double for Twilio, the only third-party transport this gateway sends
 * on. The passwordless phone routes (`/v1/phone/auth/start`,
 * `/v1/phone/register/start`, `/v1/phone/verify`) all dispatch an SMS, so a
 * test that exercises `services/phone/router` without this would bill real
 * messages to whatever number the fixture happens to name.
 *
 * Patched at `Twilio.prototype.request` — the single choke point every Twilio
 * resource call funnels through — so a future call site cannot slip past by
 * constructing its own client.
 *
 * Captured sends land in `smsOutbox` so tests can assert what would have gone
 * out. `tests/setup.ts` registers a root hook that resets before every test,
 * so ordering between spec files is not a correctness concern; a suite may
 * still call `resetSmsOutbox()` itself.
 *
 * NOTE: users-service has a near-identical Twilio double. That duplication is
 * intentional and should not be "fixed" by hoisting it into a shared package —
 * per the root CLAUDE.md abstraction rules, there is no shared test library to
 * host it, the two are free to diverge (this one covers SMS only; the
 * users-service copy also doubles SES and Stripe), and coupling two services'
 * test infrastructure to one module would make an SDK upgrade in either
 * service a cross-service change.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// The SDK request/response shapes are internal to Twilio's client; typing them
// here would couple this double to SDK internals for no test benefit.

import twilio from 'twilio';

export interface ISentSms {
    to?: string;
    from?: string;
    body?: string;
}

export const smsOutbox: ISentSms[] = [];

export const resetSmsOutbox = () => {
    smsOutbox.length = 0;
};

let isInstalled = false;

/**
 * Idempotent — `tests/setup.ts` is the only intended caller, but mocha can
 * load a required file more than once across watch runs.
 */
export const installOutboundTransportStubs = () => {
    if (isInstalled) {
        return;
    }
    isInstalled = true;

    twilio.Twilio.prototype.request = function stubbedRequest(opts: any) {
        const data = opts?.data || {};
        smsOutbox.push({
            to: data.To,
            from: data.From,
            body: data.Body,
        });

        // Mirrors the shape Twilio's resource layer expects back from an HTTP
        // POST so `messages.create()` resolves to a MessageInstance as usual.
        return Promise.resolve({
            statusCode: 201,
            body: {
                sid: `SM${'0'.repeat(30)}${smsOutbox.length}`,
                status: 'queued',
                to: data.To,
                from: data.From,
                body: data.Body,
            },
        });
    } as any;
};

export default installOutboundTransportStubs;
