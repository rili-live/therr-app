/**
 * Test doubles for the three transports in this service that reach a third
 * party: AWS SES (email), Twilio (SMS), and Stripe (payments).
 *
 * Installed once from `tests/setup.ts`, so no test — present or future — can
 * send a real email or SMS, or call the live Stripe API. This matters because
 * `tests/setup.ts` loads the root `.env`, which on a developer machine holds
 * live SES, Twilio, and Stripe credentials: without these stubs, any test that
 * reaches a dispatch path bills a real SMS, mails a real (usually bouncing)
 * address, or mutates a real Stripe account.
 *
 * Each is patched at the SDK's own choke point rather than at our `api/aws` /
 * `api/twilio` / `api/stripe` wrappers:
 *   - every SESv2 command funnels through `SESv2.prototype.send`
 *   - every Twilio resource call funnels through `Twilio.prototype.request`
 *   - every Stripe resource call funnels through `StripeResource.prototype._makeRequest`
 * so a future call site cannot slip past by constructing its own client.
 *
 * SES and Twilio sends are *captured* into `emailOutbox` / `smsOutbox` so tests
 * can assert on what would have gone out. Call `resetOutboxes()` in a
 * `beforeEach` when asserting — though `tests/setup.ts` also registers a root
 * hook that resets before every test, so ordering between files is not a
 * correctness concern.
 *
 * Stripe is deliberately different: it *rejects* rather than returning a
 * plausible fake. There is no meaningful "what would have gone out" for a
 * payments read — a test that reaches the live API is simply missing a stub,
 * and fabricating a response would let it pass against invented data. The
 * attempt is still recorded in `stripeAttempts` so the failure message can name
 * the exact call that needs stubbing.
 *
 * Individual tests may still `sinon.stub(awsSES, 'sendEmail')` or
 * `sinon.stub(stripe.customers, 'retrieve')` — an instance stub shadows the
 * prototype patch, and `sinon.restore()` uncovers the patch again rather than
 * the real transport.
 */

// The SDK command/response shapes are internal to each vendor's client; typing
// them here would couple these doubles to SDK internals for no test benefit.

import { SESv2 } from '@aws-sdk/client-sesv2';
import twilio from 'twilio';
import Stripe from 'stripe';

export interface ISentEmail {
    toAddresses: string[];
    fromEmailAddress?: string;
    subject?: string;
    html?: string;
}

export interface ISentSms {
    to?: string;
    from?: string;
    body?: string;
}

export interface IStripeAttempt {
    method?: string;
    path?: string;
}

export const emailOutbox: ISentEmail[] = [];
export const smsOutbox: ISentSms[] = [];
export const stripeAttempts: IStripeAttempt[] = [];

export const resetOutboxes = () => {
    emailOutbox.length = 0;
    smsOutbox.length = 0;
    stripeAttempts.length = 0;
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

    SESv2.prototype.send = function stubbedSend(command: any) {
        const input = command?.input || {};
        const simple = input.Content?.Simple;
        emailOutbox.push({
            toAddresses: input.Destination?.ToAddresses || [],
            fromEmailAddress: input.FromEmailAddress,
            subject: simple?.Subject?.Data,
            html: simple?.Body?.Html?.Data,
        });

        return Promise.resolve({ MessageId: `test-ses-message-${emailOutbox.length}` });
    } as any;

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

    // `StripeResource` is exposed on the client instance, not on `Stripe`
    // itself, so reach it through a throwaway client. Every resource namespace
    // (customers, products, subscriptions, …) inherits from this one prototype
    // and every generated method funnels through `_makeRequest`, so a single
    // patch here covers the whole surface — including resources added by a
    // future SDK upgrade. An empty API key is fine: nothing is ever sent.
    // apiVersion mirrors src/api/stripe.ts so the throwaway client is built
    // the same way the production one is.
    const stripeResourceProto = (new Stripe('', { apiVersion: '2022-11-15' }) as any).StripeResource?.prototype;
    if (stripeResourceProto) {
        // The leading underscore is stripe-node's name for its own choke point,
        // not ours; renaming is not an option and patching anything further out
        // would miss call sites.
        // eslint-disable-next-line no-underscore-dangle
        stripeResourceProto._makeRequest = function stubbedMakeRequest(...args: any[]) {
            // args[0] is the positional path/data array; the request spec
            // (method + full path) is on the resource's own command config.
            const spec = args[1] || {};
            const attempt: IStripeAttempt = {
                method: spec.method,
                path: spec.fullPath || spec.path,
            };
            stripeAttempts.push(attempt);

            const label = [attempt.method, attempt.path].filter(Boolean).join(' ') || 'an unknown endpoint';
            return Promise.reject(new Error(
                `Blocked a live Stripe API call to ${label} from the test suite. `
                + 'Stub the specific resource method instead, e.g. '
                + "sinon.stub(stripe.customers, 'retrieve').resolves(...) — see tests/helpers/outboundStubs.ts.",
            ));
        };
    }
};

export default installOutboundTransportStubs;
