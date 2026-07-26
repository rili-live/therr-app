/**
 * Test doubles for the two transports in this service that reach a third party:
 * AWS SES (email) and Twilio (SMS).
 *
 * Installed once from `tests/setup.ts`, so no test — present or future — can
 * send a real email or SMS. This matters because `tests/setup.ts` loads the
 * root `.env`, which on a developer machine holds live SES and Twilio
 * credentials: without these stubs, any test that reaches a dispatch path
 * bills a real SMS and mails a real (usually bouncing) address.
 *
 * Both are patched at the SDK's own choke point rather than at our
 * `api/aws` / `api/twilio` wrappers:
 *   - every SESv2 command funnels through `SESv2.prototype.send`
 *   - every Twilio resource call funnels through `Twilio.prototype.request`
 * so a future call site cannot slip past by constructing its own client.
 *
 * Captured sends land in `emailOutbox` / `smsOutbox` so tests can assert on
 * what *would* have gone out. Call `resetOutboxes()` in a `beforeEach` when
 * asserting, otherwise sends from earlier tests are still in the array.
 *
 * Individual tests may still `sinon.stub(awsSES, 'sendEmail')` — an instance
 * stub shadows the prototype patch, and `sinon.restore()` uncovers the patch
 * again rather than the real transport.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// The SDK command/response shapes are internal to each vendor's client; typing
// them here would couple these doubles to SDK internals for no test benefit.

import { SESv2 } from '@aws-sdk/client-sesv2';
import twilio from 'twilio';

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

export const emailOutbox: ISentEmail[] = [];
export const smsOutbox: ISentSms[] = [];

export const resetOutboxes = () => {
    emailOutbox.length = 0;
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
};

export default installOutboundTransportStubs;
