import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import path from 'path';
import { createMessage } from '../../../src/api/firebaseAdmin';

// firebase-admin's own client-side validator — the exact check that runs inside
// messaging.send(), and the thing that was rejecting every one of these messages
// in production. Asserting against it beats re-implementing "looks like strings"
// here, because it also covers the reserved/blacklisted data keys.
//
// Resolved by file path rather than imported: `firebase-admin`'s package exports
// map does not expose ./lib/**, so a normal import fails with
// ERR_PACKAGE_PATH_NOT_EXPORTED. This is a deliberate reach into an internal, and
// it is confined to this test — if a future firebase-admin moves the file, this
// test fails loudly at load rather than silently asserting nothing.
// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require
const { validateMessage } = require(path.join(
    path.dirname(require.resolve('firebase-admin')),
    'messaging',
    'messaging-internal.js',
));

/**
 * FCM `data` payloads must be string -> string.
 *
 * WHAT BROKE
 *
 * `createMessage` built its `data` map with
 *
 *     typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]
 *
 * which copies anything non-object through untouched. Every caller of
 * `predictAndSendPushNotification` builds its `data` literal from a fixed key
 * set (`area`, `groupId`, `postType`, `thought`, ...) and leaves the irrelevant
 * ones `undefined` — and `typeof undefined` is 'undefined', not 'object'. So
 * those keys reached firebase-admin as real `undefined` values, `validateMessage`
 * threw "data must only contain string values", and the message never left the
 * process.
 *
 * WHY IT WENT UNNOTICED FOR WEEKS
 *
 * `predictAndSendNotification` catches everything, the send route answered 201
 * regardless, and the users-service queue worker then marked the row 'sent'.
 * Production showed 146 habits notifications 'sent' and 0 'failed' while nothing
 * had been delivered; the logs showed 77 of these throws against 19 real sends
 * in the same 30-day window.
 *
 * The push diagnostics endpoint could not catch it either — it builds `data` as
 * `{ fromUser }`, one object key, always valid — which is why
 * `_bin/push-debug.sh` reported a healthy chain throughout.
 *
 * These tests therefore assert on the *caller's* real data shape, not a
 * hand-tidied one.
 */

// Exactly the object literal `predictAndSendPushNotification` passes to
// createMessage. Over HTTP, JSON.stringify drops undefined keys from the body,
// so the handler's destructure yields undefined and this literal re-creates them
// as present-but-undefined — which is the whole bug. Keep this shape verbatim.
const digestNotificationData = () => {
    const body: any = {
        type: PushNotifications.Types.streakAtRisk,
        toUserDeviceToken: 'test-device-token',
        habitName: 'Morning workout',
        streakCount: 4,
        freezesRemaining: 1,
        pactId: 'c0000001-de00-4000-a000-000000000001',
    };
    const {
        area, groupId, fromUser, fromUserId, fromUserName, postType, thought,
    } = body;

    return {
        area,
        groupId,
        fromUser: fromUser || { id: fromUserId, userName: fromUserName },
        postType,
        thought,
    } as any;
};

const baseConfig = {
    deviceToken: 'test-device-token',
    userId: 'a730f85b-0000-4000-8000-000000000001',
    userLocale: 'en-us',
};

describe('FCM data payload validity', () => {
    // The three types the habits daily digest produces. All of them are
    // data-only messages, so a bad `data` map is fatal rather than cosmetic.
    const digestTypes = [
        PushNotifications.Types.streakAtRisk,
        PushNotifications.Types.partnerMissedDay,
        PushNotifications.Types.pactExpiring,
    ];

    digestTypes.forEach((type) => {
        it(`builds a message firebase-admin accepts for "${type}"`, () => {
            const message = createMessage(
                type,
                digestNotificationData(),
                {
                    ...baseConfig,
                    habitName: 'Morning workout',
                    partnerName: 'Sam',
                    streakCount: 4,
                    freezesRemaining: 1,
                    daysRemaining: 2,
                },
                BrandVariations.HABITS,
            );

            expect(message, `createMessage returned false for ${type}`).to.not.equal(false);
            // Throws "data must only contain string values" on regression.
            expect(() => validateMessage(message as any)).to.not.throw();
        });
    });

    it('drops null and undefined keys instead of forwarding them', () => {
        const message: any = createMessage(
            PushNotifications.Types.streakAtRisk,
            {
                area: undefined, groupId: null, postType: undefined, thought: undefined, fromUser: {},
            } as any,
            { ...baseConfig, habitName: 'Morning workout', streakCount: 1 },
            BrandVariations.HABITS,
        );

        expect(message).to.not.equal(false);
        expect(message.data).to.not.have.property('area');
        expect(message.data).to.not.have.property('groupId');
        expect(message.data).to.not.have.property('postType');
        expect(message.data).to.not.have.property('thought');
    });

    it('coerces non-string primitives rather than passing them through', () => {
        const message: any = createMessage(
            PushNotifications.Types.streakAtRisk,
            { streakCount: 7, hasProof: true, fromUser: {} } as any,
            { ...baseConfig, habitName: 'Morning workout', streakCount: 7 },
            BrandVariations.HABITS,
        );

        expect(message).to.not.equal(false);
        expect(message.data.streakCount).to.equal('7');
        expect(message.data.hasProof).to.equal('true');
        Object.entries(message.data).forEach(([key, value]) => {
            expect(value, `data.${key} must be a string`).to.be.a('string');
        });
    });

    // The regression net: every type this service will actually send must build
    // a valid envelope from the caller's real data shape. A new case that
    // forwards a number or leaves a key undefined fails here rather than in
    // production, where the failure is invisible.
    it('every sendable notification type builds a valid envelope', () => {
        const failures: string[] = [];

        Object.values(PushNotifications.Types).forEach((type) => {
            const message = createMessage(
                type as PushNotifications.Types,
                digestNotificationData(),
                {
                    ...baseConfig,
                    habitName: 'Morning workout',
                    partnerName: 'Sam',
                    fromUserName: 'Sam',
                    groupName: 'Runners',
                    streakCount: 4,
                    previousRecordDays: 3,
                    daysRemaining: 2,
                    freezesRemaining: 1,
                    freezeDaysUsed: 0,
                    dayCount: 21,
                    consistencyPercent: 93,
                    bestStreakCount: 12,
                    rank: 2,
                },
                BrandVariations.HABITS,
            );

            // `false` means the type has no case at all — that is a separate,
            // already-reported condition (`unsupported-notification-type`), not
            // a payload defect.
            if (message === false) {
                return;
            }

            try {
                validateMessage(message as any);
            } catch (err: any) {
                failures.push(`${type}: ${err?.message}`);
            }
        });

        expect(failures, `invalid FCM envelopes:\n  ${failures.join('\n  ')}`).to.have.lengthOf(0);
    });
});
