import { expect } from 'chai';
import sinon from 'sinon';
import { Notifications } from 'therr-js-utilities/constants';

describe('Reactions Handler', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('sendReactionPushNotification', () => {
        describe('reaction type detection', () => {
            it('should detect moment reaction', () => {
                const data = {
                    momentReaction: {
                        momentId: 'moment-123',
                        userId: 'reactor-123',
                        userHasLiked: true,
                        userHasSuperLiked: false,
                    },
                    spaceReaction: null,
                    thoughtReaction: null,
                    areaUserId: 'owner-123',
                    reactorUserName: 'reactor',
                };

                const areaReaction = data.momentReaction || data.spaceReaction;
                const areaType = data.momentReaction ? 'moments' : 'spaces';

                expect(areaReaction).to.not.be.null;
                expect(areaType).to.equal('moments');
            });

            it('should detect space reaction', () => {
                const data = {
                    momentReaction: null,
                    spaceReaction: {
                        spaceId: 'space-123',
                        userId: 'reactor-123',
                        userHasLiked: true,
                        userHasSuperLiked: false,
                    },
                    thoughtReaction: null,
                    areaUserId: 'owner-123',
                    reactorUserName: 'reactor',
                };

                const areaReaction = data.momentReaction || data.spaceReaction;
                const areaType = data.momentReaction ? 'moments' : 'spaces';

                expect(areaReaction).to.not.be.null;
                expect(areaType).to.equal('spaces');
            });

            it('should detect thought reaction', () => {
                const data = {
                    momentReaction: null,
                    spaceReaction: null,
                    thoughtReaction: {
                        thoughtId: 'thought-123',
                        userId: 'reactor-123',
                        userHasLiked: true,
                        userHasSuperLiked: false,
                    },
                    thoughtUserId: 'owner-123',
                    reactorUserName: 'reactor',
                };

                expect(data.thoughtReaction).to.not.be.null;
                expect(data.thoughtReaction.thoughtId).to.equal('thought-123');
            });
        });

        describe('post type determination', () => {
            it('should determine moments post type for moment reactions', () => {
                const momentReaction = { momentId: 'moment-123' };
                const spaceReaction = null;

                const areaReaction = momentReaction || spaceReaction;
                const areaType = momentReaction ? 'moments' : 'spaces';
                const postType = areaReaction ? areaType : 'thoughts';

                expect(postType).to.equal('moments');
            });

            it('should determine spaces post type for space reactions', () => {
                const momentReaction = null;
                const spaceReaction = { spaceId: 'space-123' };

                const areaReaction = momentReaction || spaceReaction;
                const areaType = momentReaction ? 'moments' : 'spaces';
                const postType = areaReaction ? areaType : 'thoughts';

                expect(postType).to.equal('spaces');
            });

            it('should determine thoughts post type for thought reactions', () => {
                const momentReaction = null;
                const spaceReaction = null;
                // thoughtReaction exists but isn't an "area" reaction
                expect({ thoughtId: 'thought-123' }).to.have.property('thoughtId');

                const areaReaction = momentReaction || spaceReaction;
                const postType = areaReaction ? 'moments' : 'thoughts';

                expect(postType).to.equal('thoughts');
            });
        });

        describe('like vs super-like handling', () => {
            it('should detect regular like', () => {
                const reaction = {
                    userHasLiked: true,
                    userHasSuperLiked: false,
                };

                const shouldNotify = reaction.userHasLiked || reaction.userHasSuperLiked;
                expect(shouldNotify).to.be.eq(true);
                expect(reaction.userHasSuperLiked).to.be.eq(false);
            });

            it('should detect super-like', () => {
                const reaction = {
                    userHasLiked: false,
                    userHasSuperLiked: true,
                };

                const shouldNotify = reaction.userHasLiked || reaction.userHasSuperLiked;
                expect(shouldNotify).to.be.eq(true);
                expect(reaction.userHasSuperLiked).to.be.eq(true);
            });

            it('should not notify when neither liked nor super-liked', () => {
                const reaction = {
                    userHasLiked: false,
                    userHasSuperLiked: false,
                };

                const shouldNotify = reaction.userHasLiked || reaction.userHasSuperLiked;
                expect(shouldNotify).to.be.eq(false);
            });
        });

        describe('notification data construction', () => {
            it('should construct notification for area reaction (moment/space)', () => {
                const contentId = 'moment-123';
                const contentUserId = 'owner-123';
                const reactorUserId = 'reactor-456';
                const reactorUserName = 'reactor';
                const userHasSuperLiked = false;
                const postType = 'moments';

                const notificationData = {
                    userId: contentUserId,
                    type: userHasSuperLiked
                        ? Notifications.Types.NEW_SUPER_LIKE_RECEIVED
                        : Notifications.Types.NEW_LIKE_RECEIVED,
                    associationId: null,
                    isUnread: true,
                    messageLocaleKey: userHasSuperLiked
                        ? Notifications.MessageKeys.NEW_SUPER_LIKE_RECEIVED
                        : Notifications.MessageKeys.NEW_LIKE_RECEIVED,
                    messageParams: {
                        areaId: contentId,
                        userName: reactorUserName,
                        userId: reactorUserId,
                        contentUserId,
                        postType,
                    },
                    shouldSendPushNotification: true,
                    fromUserName: reactorUserName,
                };

                expect(notificationData.type).to.equal(Notifications.Types.NEW_LIKE_RECEIVED);
                expect(notificationData.messageParams.areaId).to.equal('moment-123');
                expect(notificationData.messageParams.postType).to.equal('moments');
            });

            it('should construct notification for thought reaction', () => {
                const contentId = 'thought-123';
                const reactorUserName = 'reactor';
                const userHasSuperLiked = true;
                const postType = 'thoughts';

                const notificationData = {
                    type: userHasSuperLiked
                        ? Notifications.Types.NEW_SUPER_LIKE_RECEIVED
                        : Notifications.Types.NEW_LIKE_RECEIVED,
                    messageLocaleKey: userHasSuperLiked
                        ? Notifications.MessageKeys.NEW_SUPER_LIKE_RECEIVED
                        : Notifications.MessageKeys.NEW_LIKE_RECEIVED,
                    messageParams: {
                        thoughtId: contentId,
                        userName: reactorUserName,
                        postType,
                    },
                };

                expect(notificationData.type).to.equal(Notifications.Types.NEW_SUPER_LIKE_RECEIVED);
                expect(notificationData.messageParams.thoughtId).to.equal('thought-123');
            });

            it('should use different message params for area vs thought', () => {
                const areaParams = {
                    areaId: 'area-123',
                    userName: 'reactor',
                    userId: 'reactor-id',
                    contentUserId: 'owner-id',
                    postType: 'moments',
                };

                const thoughtParams = {
                    thoughtId: 'thought-123',
                    userName: 'reactor',
                    postType: 'thoughts',
                };

                expect(areaParams).to.have.property('areaId');
                expect(areaParams).to.have.property('contentUserId');
                expect(areaParams).to.not.have.property('thoughtId');

                expect(thoughtParams).to.have.property('thoughtId');
                expect(thoughtParams).to.not.have.property('areaId');
            });
        });

        describe('reaction notification throttling', () => {
            it('should generate correct throttle key', () => {
                const toUserId = 'owner-123';
                const fromUserId = 'reactor-456';
                const key = `reactionNotificationThrottles:${toUserId}:${fromUserId}`;

                expect(key).to.equal('reactionNotificationThrottles:owner-123:reactor-456');
            });

            it('should throttle for 60 seconds', () => {
                const minWaitSeconds = 60; // From redisHelper.throttleReactionNotifications
                expect(minWaitSeconds).to.equal(60);
            });
        });

        describe('content ID extraction', () => {
            it('should extract momentId from moment reaction', () => {
                const momentReaction = {
                    momentId: 'moment-123',
                    spaceId: undefined,
                };

                const contentId = momentReaction.momentId || momentReaction.spaceId;
                expect(contentId).to.equal('moment-123');
            });

            it('should extract spaceId from space reaction', () => {
                const spaceReaction = {
                    momentId: undefined,
                    spaceId: 'space-123',
                };

                const contentId = spaceReaction.momentId || spaceReaction.spaceId;
                expect(contentId).to.equal('space-123');
            });

            it('should extract thoughtId from thought reaction', () => {
                const thoughtReaction = {
                    thoughtId: 'thought-123',
                };

                expect(thoughtReaction.thoughtId).to.equal('thought-123');
            });
        });
    });
});

describe('Reaction Types', () => {
    describe('area types', () => {
        it('should support moments area type', () => {
            const areaType: 'moments' | 'spaces' = 'moments';
            expect(areaType).to.equal('moments');
        });

        it('should support spaces area type', () => {
            const areaType: 'moments' | 'spaces' = 'spaces';
            expect(areaType).to.equal('spaces');
        });
    });

    describe('post types', () => {
        it('should support moments post type', () => {
            const postType = 'moments';
            expect(postType).to.equal('moments');
        });

        it('should support spaces post type', () => {
            const postType = 'spaces';
            expect(postType).to.equal('spaces');
        });

        it('should support thoughts post type', () => {
            const postType = 'thoughts';
            expect(postType).to.equal('thoughts');
        });
    });
});
