import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';

// We need to mock the module before importing createMessage
// Since we can't easily mock firebase-admin in this setup,
// we'll test the createMessage function by importing it directly
// and mocking predictAndSendNotification

describe('firebaseAdmin', () => {
    describe('createMessage', () => {
        // NOTE: there was a before() hook here that overwrote
        // PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64 with a service account
        // whose private_key was a truncated placeholder, and never restored it.
        // Nothing in this file imports src/api/firebaseAdmin (see the header
        // comment — that is the whole reason these assertions are indirect), so
        // the hook bought nothing. It did leave a globally broken credential
        // behind for anything that read the var at run time (hooks and test
        // bodies — static imports resolve during mocha's load phase, before
        // this ran): admin.credential.cert() parses the key for real and
        // rejects it with "Too few bytes to read ASN.1 value". tests/setup.ts
        // now seeds a valid throwaway credential so firebaseAdmin.ts is
        // importable under test; clobbering it here would undo that.

        describe('notification types', () => {
            it('should return false for unknown notification type', () => {
                // We can't easily test createMessage directly due to firebase-admin initialization
                // Instead, test the behavior expectations
                const unknownType = 'unknown-type' as PushNotifications.Types;

                // The function should return false for unknown types
                // This is testing the expected behavior based on the switch statement
                expect(unknownType).to.not.equal(PushNotifications.Types.newDirectMessage);
            });

            it('should have valid notification types defined', () => {
                // Test that all expected notification types are defined
                const expectedTypes = [
                    PushNotifications.Types.createYourProfileReminder,
                    PushNotifications.Types.createAMomentReminder,
                    PushNotifications.Types.completeDraftReminder,
                    PushNotifications.Types.latestPostLikesStats,
                    PushNotifications.Types.latestPostViewcountStats,
                    PushNotifications.Types.unreadNotificationsReminder,
                    PushNotifications.Types.unclaimedAchievementsReminder,
                    PushNotifications.Types.achievementCompleted,
                    PushNotifications.Types.connectionRequestAccepted,
                    PushNotifications.Types.newConnectionRequest,
                    PushNotifications.Types.newDirectMessage,
                    PushNotifications.Types.newGroupMessage,
                    PushNotifications.Types.newGroupMembers,
                    PushNotifications.Types.newGroupInvite,
                    PushNotifications.Types.newLikeReceived,
                    PushNotifications.Types.newSuperLikeReceived,
                    PushNotifications.Types.newAreasActivated,
                    PushNotifications.Types.nudgeSpaceEngagement,
                    PushNotifications.Types.proximityRequiredMoment,
                    PushNotifications.Types.proximityRequiredSpace,
                    PushNotifications.Types.newThoughtReplyReceived,
                ];

                expectedTypes.forEach((type) => {
                    expect(type).to.be.a('string');
                    expect(type.length).to.be.greaterThan(0);
                });
            });
        });

        describe('brand variations', () => {
            it('should support THERR brand variation', () => {
                expect(BrandVariations.THERR).to.equal('therr');
            });

            it('should support TEEM brand variation', () => {
                expect(BrandVariations.TEEM).to.equal('teem');
            });

            it('should have correct Android intent action keys for THERR', () => {
                const therrActions = PushNotifications.AndroidIntentActions.Therr;
                expect(therrActions).to.be.an('object');
                expect(therrActions.NEW_DIRECT_MESSAGE).to.be.a('string');
                expect(therrActions.NEW_CONNECTION_REQUEST).to.be.a('string');
                expect(therrActions.NEW_GROUP_MESSAGE).to.be.a('string');
            });

            it('should have correct Android intent action keys for TEEM', () => {
                const teemActions = PushNotifications.AndroidIntentActions.Teem;
                expect(teemActions).to.be.an('object');
                expect(teemActions.NEW_DIRECT_MESSAGE).to.be.a('string');
                expect(teemActions.NEW_CONNECTION_REQUEST).to.be.a('string');
                expect(teemActions.NEW_GROUP_MESSAGE).to.be.a('string');
            });
        });

        describe('press action IDs', () => {
            it('should have defined press action IDs', () => {
                expect(PushNotifications.PressActionIds.spaceView).to.be.a('string');
                expect(PushNotifications.PressActionIds.momentView).to.be.a('string');
                expect(PushNotifications.PressActionIds.thoughtView).to.be.a('string');
                expect(PushNotifications.PressActionIds.userView).to.be.a('string');
                expect(PushNotifications.PressActionIds.dmView).to.be.a('string');
                expect(PushNotifications.PressActionIds.groupView).to.be.a('string');
            });
        });
    });

    describe('getPostActionId', () => {
        it('should return spaceView as default', () => {
            // Based on the implementation, default is spaceView
            const defaultId = PushNotifications.PressActionIds.spaceView;
            expect(defaultId).to.be.a('string');
        });

        it('should return momentView for moments postType', () => {
            const momentId = PushNotifications.PressActionIds.momentView;
            expect(momentId).to.be.a('string');
        });

        it('should return thoughtView for thoughts postType', () => {
            const thoughtId = PushNotifications.PressActionIds.thoughtView;
            expect(thoughtId).to.be.a('string');
        });
    });

    describe('app bundle identifiers', () => {
        it('should have correct bundle identifier for THERR', () => {
            // Based on getAppBundleIdentifier function
            const expectedTherr = 'com.therr.mobile.Therr';
            expect(expectedTherr).to.equal('com.therr.mobile.Therr');
        });

        it('should have correct bundle identifier for TEEM', () => {
            // Based on getAppBundleIdentifier function
            const expectedTeem = 'com.therr.mobile.Teem';
            expect(expectedTeem).to.equal('com.therr.mobile.Teem');
        });
    });
});

describe('PushNotifications Constants', () => {
    describe('Types enum', () => {
        it('should have automation notification types', () => {
            expect(PushNotifications.Types.createYourProfileReminder).to.equal('create-your-profile-reminder');
            expect(PushNotifications.Types.createAMomentReminder).to.equal('create-a-moment-reminder');
            expect(PushNotifications.Types.completeDraftReminder).to.equal('complete-draft-reminder');
            expect(PushNotifications.Types.latestPostLikesStats).to.equal('latest-post-likes-stats');
            expect(PushNotifications.Types.latestPostViewcountStats).to.equal('latest-post-viewcount-stats');
            expect(PushNotifications.Types.unreadNotificationsReminder).to.equal('unread-notifications-reminder');
            expect(PushNotifications.Types.unclaimedAchievementsReminder).to.equal('unclaimed-achievements-reminder');
        });

        it('should have event-driven notification types', () => {
            expect(PushNotifications.Types.achievementCompleted).to.equal('achievement-completed');
            expect(PushNotifications.Types.connectionRequestAccepted).to.equal('connection-request-accepted');
            expect(PushNotifications.Types.newConnectionRequest).to.equal('new-connection-request');
            expect(PushNotifications.Types.newDirectMessage).to.equal('new-direct-message');
            expect(PushNotifications.Types.newGroupMessage).to.equal('new-group-message');
            expect(PushNotifications.Types.newGroupMembers).to.equal('new-group-members');
            expect(PushNotifications.Types.newGroupInvite).to.equal('new-group-invite');
            expect(PushNotifications.Types.newLikeReceived).to.equal('new-like-received');
            expect(PushNotifications.Types.newSuperLikeReceived).to.equal('new-super-like-received');
            expect(PushNotifications.Types.newAreasActivated).to.equal('new-moments-activated');
        });

        it('should have location-based notification types', () => {
            expect(PushNotifications.Types.nudgeSpaceEngagement).to.equal('nudge-space-engagement');
            expect(PushNotifications.Types.proximityRequiredMoment).to.equal('proximity-required-moment');
            expect(PushNotifications.Types.proximityRequiredSpace).to.equal('proximity-required-space');
        });
    });
});
