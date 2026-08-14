import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage } from '../../../src/api/firebaseAdmin';

/**
 * Per-brand routing of the FCM message envelope.
 *
 * `createDataOnlyMessage` sets `apns-topic` from the brand's bundle identifier. APNS
 * rejects a push whose topic is not the app's own bundle id, so a case that forgets to
 * forward `brandVariation` silently addresses every one of its iOS pushes to the Therr
 * app — the notification is accepted by FCM and then dropped, with no error visible to
 * the caller. `leaderboardRankMilestone` was doing exactly that.
 *
 * The equivalent slip on `createNotificationMessage` is the Android small-icon tint:
 * a HABITS notification rendered in Therr teal.
 *
 * These assertions walk every branded case rather than spot-checking, so a new
 * notification type that forgets the argument fails here instead of in the field.
 */

const config = {
    deviceToken: 'test-device-token',
    userId: 'a2b1c0d9-0000-4000-8000-000000000001',
    userLocale: 'en-us',
    fromUserName: 'partner',
    habitName: 'Morning run',
    partnerName: 'Sam',
    streakCount: 12,
    previousRecordDays: 9,
    daysRemaining: 3,
    rank: 4,
};

// The only iOS bundle id TherrMobile.xcodeproj builds. Niche branches change
// brandConfig.ts / app.json / build.gradle and leave PRODUCT_BUNDLE_IDENTIFIER
// alone, so an iOS build of any brand is this binary — and every brand's
// apns-topic must therefore be this value until a brand adds its own iOS target.
const THERR_BUNDLE_ID = 'com.therr.mobile.Therr';
const HABITS_ACCENT_COLOR = '#1C7F8A';

// Every type that createMessage renders through createDataOnlyMessage (apns alert).
const DATA_ONLY_TYPES = [
    PushNotifications.Types.latestPostViewcountStats,
    PushNotifications.Types.connectionRequestAccepted,
    PushNotifications.Types.newConnectionRequest,
    PushNotifications.Types.newDirectMessage,
    PushNotifications.Types.newGroupMessage,
    PushNotifications.Types.newLikeReceived,
    PushNotifications.Types.newSuperLikeReceived,
    PushNotifications.Types.nudgeSpaceEngagement,
    PushNotifications.Types.newThoughtReplyReceived,
    PushNotifications.Types.leaderboardRankMilestone,
    PushNotifications.Types.streakAtRisk,
    PushNotifications.Types.streakMilestone,
    PushNotifications.Types.newPersonalRecord,
    PushNotifications.Types.partnerCheckedIn,
    PushNotifications.Types.partnerMissedDay,
    PushNotifications.Types.partnerCelebrated,
    PushNotifications.Types.pactInvitation,
    PushNotifications.Types.pactNudge,
    PushNotifications.Types.pactAccepted,
    PushNotifications.Types.pactCompleted,
    PushNotifications.Types.pactExpiring,
    // HABITS lifecycle celebrations (docs/HABIT_LIFECYCLE_MESSAGING.md). Data-only
    // like the rest of the streak family — the app is expected to be awake for a
    // milestone about a habit the user is actively keeping.
    PushNotifications.Types.habitEstablished,
    PushNotifications.Types.habitAutomaticity,
    PushNotifications.Types.habitMaintenanceCheckIn,
];

// Every type that createMessage renders through createNotificationMessage (display).
const DISPLAY_TYPES = [
    PushNotifications.Types.createYourProfileReminder,
    PushNotifications.Types.createAMomentReminder,
    PushNotifications.Types.completeDraftReminder,
    PushNotifications.Types.latestPostLikesStats,
    PushNotifications.Types.unreadNotificationsReminder,
    PushNotifications.Types.unclaimedAchievementsReminder,
    PushNotifications.Types.inviteFriendsReminder,
    PushNotifications.Types.achievementCompleted,
    PushNotifications.Types.newGroupMembers,
    PushNotifications.Types.newGroupInvite,
    PushNotifications.Types.newAreasActivated,
    PushNotifications.Types.proximityRequiredMoment,
    PushNotifications.Types.proximityRequiredSpace,
    PushNotifications.Types.streakBroken,
    PushNotifications.Types.pactDeclined,
    PushNotifications.Types.dailyHabitReminder,
    PushNotifications.Types.morningMotivation,
    PushNotifications.Types.eveningCheckIn,
    // The one lifecycle message aimed at someone who has stopped opening the
    // app, so it has to render even when the app never wakes to handle it.
    PushNotifications.Types.habitComeback,
];

describe('firebaseAdmin brand routing', () => {
    describe('createDataOnlyMessage — apns-topic', () => {
        DATA_ONLY_TYPES.forEach((type) => {
            // Regression: this used to assert 'com.therr.mobile.habits' — a bundle id
            // no target in TherrMobile.xcodeproj builds. APNS silently dropped every
            // data-only push to an iOS Habits install while FCM still returned a
            // message id, so the service logged "Push successfully sent" for
            // notifications no one ever received.
            it(`addresses "${type}" for HABITS to the bundle id that actually ships`, () => {
                const message: any = createMessage(type, {}, config, BrandVariations.HABITS);

                expect(message, `${type} produced no message`).to.not.equal(false);
                expect(message.apns.headers['apns-topic']).to.equal(THERR_BUNDLE_ID);
            });
        });

        it('still addresses THERR pushes to the Therr bundle id', () => {
            const message: any = createMessage(
                PushNotifications.Types.newDirectMessage,
                {},
                config,
                BrandVariations.THERR,
            );

            expect(message.apns.headers['apns-topic']).to.equal(THERR_BUNDLE_ID);
        });

        it('defaults to the Therr bundle id when no brand is supplied', () => {
            const message: any = createMessage(PushNotifications.Types.newDirectMessage, {}, config);

            expect(message.apns.headers['apns-topic']).to.equal(THERR_BUNDLE_ID);
        });

        it('sends the leaderboard milestone as a visible alert, not a silent push', () => {
            // Regression: this case omitted brandVariation, so the alert went out under
            // the Therr topic and APNS dropped it for every Habits install.
            const message: any = createMessage(
                PushNotifications.Types.leaderboardRankMilestone,
                {},
                config,
                BrandVariations.HABITS,
            );

            expect(message.apns.headers['apns-push-type']).to.equal('alert');
            expect(message.apns.payload.aps.alert.title).to.be.a('string').that.is.not.empty;
        });
    });

    describe('createNotificationMessage — Android accent color', () => {
        DISPLAY_TYPES.forEach((type) => {
            it(`tints "${type}" with the HABITS accent color`, () => {
                const message: any = createMessage(type, {}, config, BrandVariations.HABITS);

                expect(message, `${type} produced no message`).to.not.equal(false);
                expect(message.android.notification.color).to.equal(HABITS_ACCENT_COLOR);
            });
        });
    });

    describe('click actions', () => {
        it('stamps HABITS display notifications with the habits-prefixed intent action', () => {
            const message: any = createMessage(
                PushNotifications.Types.dailyHabitReminder,
                {},
                config,
                BrandVariations.HABITS,
            );

            expect(message.android.notification.clickAction)
                .to.equal(PushNotifications.AndroidIntentActions.Habits.DAILY_HABIT_REMINDER);
            // The Android manifest must declare this exact action or the tap is a no-op;
            // TherrMobile/__tests__/androidNotificationIntentFilters.test.ts guards that end.
            expect(message.android.notification.clickAction).to.have.string('com.therr.mobile.habits.');
        });

        it('stamps HABITS data-only notifications with the habits-prefixed intent action', () => {
            const message: any = createMessage(
                PushNotifications.Types.pactInvitation,
                {},
                config,
                BrandVariations.HABITS,
            );

            expect(message.data.clickActionId)
                .to.equal(PushNotifications.AndroidIntentActions.Habits.PACT_INVITATION);
        });
    });

    // The assertions above pin apns-topic to a constant. This one pins that constant
    // to reality: it reads the Xcode project and fails if the topic we address every
    // brand's iOS pushes to is not a bundle id the project actually builds.
    //
    // Without this, the previous bug is fully reproducible — someone adds a brand,
    // writes the "obvious" bundle id for it, every unit test agrees with them, and
    // APNS silently discards that brand's pushes in production.
    describe('apns-topic matches a shipped iOS target', () => {
        const pbxprojPath = path.resolve(
            __dirname,
            '../../../../../TherrMobile/ios/Therr.xcodeproj/project.pbxproj',
        );

        it('addresses every brand to a PRODUCT_BUNDLE_IDENTIFIER declared in Therr.xcodeproj', function test() {
            if (!fs.existsSync(pbxprojPath)) {
                // The service is also built and tested in a container that only
                // copies therr-services/ — skip rather than fail on a missing peer package.
                // `this.skip()` throws, so nothing below runs.
                this.skip();
            }

            const pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
            const declaredBundleIds = new Set(
                Array.from(pbxproj.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([\w.$()<>:]+)"?;/g))
                    .map((match) => match[1])
                    // The RN template leaves a placeholder on the test target.
                    .filter((id) => !id.includes('org.reactjs.native.example')),
            );

            expect(declaredBundleIds.size, 'found no bundle ids — the pbxproj regex needs updating').to.be.greaterThan(0);

            (Object.values(BrandVariations) as BrandVariations[]).forEach((brand) => {
                const message: any = createMessage(
                    PushNotifications.Types.newDirectMessage,
                    {},
                    config,
                    brand,
                );
                const topic = message.apns.headers['apns-topic'];

                expect(
                    Array.from(declaredBundleIds),
                    `apns-topic "${topic}" for brand "${brand}" is not built by any iOS target. `
                    + 'APNS drops such pushes silently. Either point the brand at the bundle id its '
                    + 'iOS build actually uses, or add the iOS target in the same change.',
                ).to.include(topic);
            });
        });
    });

    it('returns false for an unknown type', () => {
        expect(createMessage('not-a-real-type' as any, {}, config, BrandVariations.HABITS)).to.equal(false);
    });

    // Keeps the two lists above honest. Without this, a notification type added to
    // createMessage is simply absent from both arrays and every assertion still
    // passes — the coverage silently stops being total, which is the one property
    // that makes these tests worth having.
    it('classifies every notification type that createMessage handles', () => {
        const classified = new Set<string>([...DATA_ONLY_TYPES, ...DISPLAY_TYPES]);
        const unclassified = Object.values(PushNotifications.Types)
            .filter((type) => !classified.has(type as string))
            // An unhandled type falls to the `default` branch and returns false.
            .filter((type) => createMessage(type as PushNotifications.Types, {}, config, BrandVariations.HABITS) !== false);

        expect(
            unclassified,
            'add these to DATA_ONLY_TYPES or DISPLAY_TYPES so their brand routing is covered',
        ).to.deep.equal([]);
    });
});
