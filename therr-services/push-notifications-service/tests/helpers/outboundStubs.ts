/**
 * Test double for Firebase Cloud Messaging, the only third-party transport this
 * service sends on.
 *
 * Installed once from `tests/setup.ts`, so no test — present or future — can
 * deliver a real push. This is the same class of risk that SES and Twilio pose
 * in users-service, and it is arguably worse: a stray send here lands on real
 * handsets belonging to real users, and there is no billing line to notice it
 * afterwards. A developer shell (or CI) carrying real
 * `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64` is all it takes.
 *
 * Patched at `Messaging.prototype.*` rather than at our `api/firebaseAdmin`
 * wrapper. Every `admin.app().messaging()` instance — including the per-brand
 * apps built lazily by `getAdminAppForBrand` — is an instance of this one
 * class, so a future call site cannot slip past by initializing its own app.
 *
 * All the batch variants are covered, not just `send()`, which is the only one
 * production currently calls. The point of a choke point is that it holds when
 * someone reaches for `sendEach` to batch a fan-out; leaving those live would
 * make the net silently partial.
 *
 * Captured sends land in `pushOutbox` so tests can assert on what would have
 * gone out. `tests/setup.ts` registers a root hook that resets before every
 * test, so ordering between spec files is not a correctness concern.
 */

// The SDK message/response shapes are internal to firebase-admin; typing them
// here would couple this double to SDK internals for no test benefit.

import { Messaging } from 'firebase-admin/messaging';

export interface ISentPush {
    token?: string;
    topic?: string;
    condition?: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
}

export const pushOutbox: ISentPush[] = [];

export const resetPushOutbox = () => {
    pushOutbox.length = 0;
};

const toSentPush = (message: any): ISentPush => ({
    token: message?.token,
    topic: message?.topic,
    condition: message?.condition,
    title: message?.notification?.title,
    body: message?.notification?.body,
    data: message?.data,
});

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

    // Single send: resolves to a message ID string, matching FCM.
    Messaging.prototype.send = function stubbedSend(message: any) {
        pushOutbox.push(toSentPush(message));
        return Promise.resolve(`projects/test-project/messages/${pushOutbox.length}`);
    } as any;

    // Batch sends: resolve to a BatchResponse. Reporting every message as a
    // success keeps callers on their happy path; a test that needs a partial
    // failure should stub the specific method for that case.
    const stubbedBatchSend = function stubbedBatchSend(messages: any[]) {
        const list = Array.isArray(messages) ? messages : [];
        list.forEach((message) => pushOutbox.push(toSentPush(message)));
        return Promise.resolve({
            responses: list.map((_message, index) => ({
                success: true,
                messageId: `projects/test-project/messages/batch-${index + 1}`,
            })),
            successCount: list.length,
            failureCount: 0,
        });
    };
    Messaging.prototype.sendEach = stubbedBatchSend as any;
    Messaging.prototype.sendAll = stubbedBatchSend as any;

    // Multicast: one message shape fanned out across many tokens.
    const stubbedMulticastSend = function stubbedMulticastSend(message: any) {
        const tokens: string[] = message?.tokens || [];
        tokens.forEach((token) => pushOutbox.push({ ...toSentPush(message), token }));
        return Promise.resolve({
            responses: tokens.map((_token, index) => ({
                success: true,
                messageId: `projects/test-project/messages/multicast-${index + 1}`,
            })),
            successCount: tokens.length,
            failureCount: 0,
        });
    };
    Messaging.prototype.sendEachForMulticast = stubbedMulticastSend as any;
    Messaging.prototype.sendMulticast = stubbedMulticastSend as any;
};

export default installOutboundTransportStubs;
