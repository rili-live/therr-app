import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { predictAndSendPushNotification } from '../../../src/handlers/notifications';
import { isInvalidTokenError } from '../../../src/api/firebaseAdmin';

/**
 * A dead device token must be cleared for the user it belongs to.
 *
 * users-service sets `x-userid` on this route to the *sender* — empty for system pushes
 * like the daily habit reminders — and the recipient was never sent at all. Cleanup keyed
 * on `x-userid`, so for every reminder recipient whose app was uninstalled it returned
 * early: the token stayed, every send 502'd, and the notification queue retried it three
 * times a row, every day. In production (2026-10-13) eleven Friends with Habits users had
 * been failing daily this way, some since July.
 */

const buildRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

const withRejectingSend = async (
    run: () => Promise<void>,
    rejection: Error = Object.assign(new Error('NotRegistered'), { code: 'messaging/registration-token-not-registered' }),
) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { Messaging } = require('firebase-admin/messaging');
    const original = Messaging.prototype.send;
    Messaging.prototype.send = sinon.stub().rejects(rejection);
    try {
        await run();
    } finally {
        Messaging.prototype.send = original;
    }
};

const send = async (headers: Record<string, string>, body: Record<string, any>) => {
    const req: any = {
        headers: {
            'x-brand-variation': BrandVariations.HABITS,
            'x-localecode': 'en-us',
            ...headers,
        },
        body: {
            toUserDeviceToken: 'dead-token-abc',
            type: PushNotifications.Types.pactInvitation,
            ...body,
        },
    };
    const res = buildRes();
    await predictAndSendPushNotification(req, res, () => undefined);
    return res;
};

describe('predictAndSendPushNotification — dead token cleanup', () => {
    let clearStub: sinon.SinonStub;

    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const userHelpers = require('../../../src/handlers/helpers/user');
        clearStub = sinon.stub(userHelpers, 'clearInvalidDeviceToken').resolves();
    });

    afterEach(() => {
        clearStub.restore();
    });

    it('clears the recipient\'s token on a system push, which has no sender', async () => {
        await withRejectingSend(async () => {
            const res = await send({ 'x-userid': '' }, { toUserId: 'recipient-1' });

            expect(res.status.firstCall.args[0]).to.equal(502);
            expect(clearStub.calledOnce, 'clearInvalidDeviceToken must run').to.equal(true);
            expect(clearStub.firstCall.args[1]).to.equal('recipient-1');
            expect(clearStub.firstCall.args[2]).to.equal('dead-token-abc');
        });
    });

    it('clears for the recipient, not the sender, when a partner sent it', async () => {
        await withRejectingSend(async () => {
            await send({ 'x-userid': 'sender-9' }, { toUserId: 'recipient-1' });

            expect(clearStub.firstCall.args[1]).to.equal('recipient-1');
        });
    });

    it('still attempts cleanup for a caller that predates toUserId', async () => {
        await withRejectingSend(async () => {
            await send({ 'x-userid': 'sender-9' }, {});

            // users-service deletes the brand-scoped row by token alone, so the sender id
            // still gets the dead token removed — the pre-fix behaviour, kept for old callers.
            expect(clearStub.firstCall.args[1]).to.equal('sender-9');
            expect(clearStub.firstCall.args[2]).to.equal('dead-token-abc');
        });
    });

    /**
     * FCM's INVALID_ARGUMENT covers a malformed message as well as a malformed token. Until
     * 2026-10-27 every clear failed in users-service, so treating both as a dead token was
     * harmless; with cleanup working, one payload bug in a digest run would have deleted the
     * registration of every recipient it reached.
     */
    it('does not clear the token when invalid-argument is about the message', async () => {
        await withRejectingSend(async () => {
            const res = await send({ 'x-userid': '' }, { toUserId: 'recipient-1' });

            expect(res.status.firstCall.args[0]).to.equal(502);
            expect(res.send.firstCall.args[0].errorCode).to.equal('messaging/invalid-argument');
            expect(clearStub.called).to.equal(false);
        }, Object.assign(
            new Error('Invalid value at \'message.android.notification.color\''),
            { code: 'messaging/invalid-argument' },
        ));
    });

    it('clears the token when invalid-argument names the registration token', async () => {
        await withRejectingSend(async () => {
            await send({ 'x-userid': '' }, { toUserId: 'recipient-1' });

            expect(clearStub.calledOnce).to.equal(true);
        }, Object.assign(
            new Error('The registration token is not a valid FCM registration token'),
            { code: 'messaging/invalid-argument' },
        ));
    });
});

describe('isInvalidTokenError', () => {
    it('recognises the always-dead token codes, on code or errorInfo.code', () => {
        expect(isInvalidTokenError({ code: 'messaging/registration-token-not-registered' })).to.equal(true);
        expect(isInvalidTokenError({ errorInfo: { code: 'messaging/invalid-registration-token' } })).to.equal(true);
    });

    it('does not treat credential or payload failures as a dead token', () => {
        expect(isInvalidTokenError({ code: 'messaging/mismatched-credential', message: 'SenderId mismatch' })).to.equal(false);
        expect(isInvalidTokenError({ code: 'messaging/invalid-argument', message: 'Message payload too large' })).to.equal(false);
        expect(isInvalidTokenError(undefined)).to.equal(false);
    });
});
