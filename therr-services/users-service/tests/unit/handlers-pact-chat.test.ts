import { expect } from 'chai';
import sinon from 'sinon';
import { PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    attachUnreadMessageCounts,
    buildMessagePreview,
    buildPactMessageDedupeKey,
    createPactMessage,
    getPactChat,
    MAX_MESSAGE_LENGTH,
    mergeTimeline,
    PACT_MESSAGE_PUSH_DELAY_MS,
    reportPactMessage,
    resolveChatAccess,
    setPactChatMute,
    setPactChatReaction,
} from '../../src/handlers/pactChat';
import { decidePactMessageFreshness } from '../../src/utilities/pactMessageFreshness';

/**
 * Pact chat (docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md): who may read and post, how
 * the two timeline sources merge, and how a message turns into at most one push per recipient
 * per hour.
 */

const SENDER = 'aaaaaaaa-0000-4000-8000-000000000001';
const PARTNER = 'aaaaaaaa-0000-4000-8000-000000000002';
const MUTED = 'aaaaaaaa-0000-4000-8000-000000000003';
const BLOCKER = 'aaaaaaaa-0000-4000-8000-000000000004';
const INVITEE = 'aaaaaaaa-0000-4000-8000-000000000005';
const PACT_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
const OLD_CYCLE_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const MESSAGE_ID = 'cccccccc-0000-4000-8000-000000000001';
const CHECKIN_ID = 'dddddddd-0000-4000-8000-000000000001';
const HABIT_GOAL_ID = 'eeeeeeee-0000-4000-8000-000000000001';

const activePact = (overrides: any = {}) => ({
    id: PACT_ID,
    creatorUserId: SENDER,
    partnerUserId: null,
    habitGoalId: HABIT_GOAL_ID,
    status: 'active',
    ...overrides,
});

const member = (userId: string, overrides: any = {}) => ({
    id: `member-${userId}`, pactId: PACT_ID, userId, status: 'active', shouldMuteNotifs: false, ...overrides,
});

const call = async (handler: any, {
    userId = SENDER,
    params = { pactId: PACT_ID },
    body = {},
    query = {},
}: any = {}) => {
    const captured: { statusCode?: number; body?: any } = {};
    const res = {
        status: (statusCode: number) => {
            captured.statusCode = statusCode;
            return { send: (payload: any) => { captured.body = payload; return payload; } };
        },
    } as any;
    await handler({
        headers: {
            'x-userid': userId,
            'x-username': 'sender_name',
            'x-localecode': 'en-us',
            'x-brand-variation': 'habits',
        },
        params,
        body,
        query,
    } as any, res, (() => undefined) as any);
    return captured;
};

describe('pact chat', () => {
    afterEach(() => sinon.restore());

    describe('resolveChatAccess', () => {
        it('lets active and completed members read, and only active members of a running pact post', () => {
            expect(resolveChatAccess(activePact(), member(SENDER), SENDER)).to.deep.equal({ canRead: true, canPost: true });
            expect(resolveChatAccess(activePact({ status: 'expired' }), member(SENDER), SENDER))
                .to.deep.equal({ canRead: true, canPost: false });
            expect(resolveChatAccess(activePact(), member(SENDER, { status: 'completed' }), SENDER))
                .to.deep.equal({ canRead: true, canPost: false });
        });

        it('refuses pending invitees and members who left or were removed', () => {
            ['pending', 'left', 'removed'].forEach((status) => {
                expect(resolveChatAccess(activePact(), member(INVITEE, { status }), INVITEE))
                    .to.deep.equal({ canRead: false, canPost: false });
            });
        });

        it('falls back to the 1:1 columns for a legacy pact with no member row', () => {
            const legacy = activePact({ partnerUserId: PARTNER });
            expect(resolveChatAccess(legacy, undefined, PARTNER)).to.deep.equal({ canRead: true, canPost: true });
            expect(resolveChatAccess(legacy, undefined, INVITEE)).to.deep.equal({ canRead: false, canPost: false });
        });
    });

    describe('buildPactMessageDedupeKey', () => {
        it('buckets by the UTC hour of the message, so a burst shares one key', () => {
            const first = buildPactMessageDedupeKey(PACT_ID, '2026-10-29T14:01:00.000Z');
            const later = buildPactMessageDedupeKey(PACT_ID, new Date('2026-10-29T14:59:59.000Z'));
            const nextHour = buildPactMessageDedupeKey(PACT_ID, '2026-10-29T15:00:00.000Z');

            expect(first).to.equal(`pact-message:${PACT_ID}:2026-10-29T14`);
            expect(later).to.equal(first);
            expect(nextHour).to.not.equal(first);
        });
    });

    describe('buildMessagePreview', () => {
        it('takes the first non-empty line and caps it', () => {
            expect(buildMessagePreview('\n  Done!  \nsecond line')).to.equal('Done!');
            const long = buildMessagePreview('x'.repeat(300));
            expect(long.length).to.equal(100);
            expect(long.endsWith('…')).to.equal(true);
        });
    });

    describe('mergeTimeline', () => {
        const message = (id: string, createdAt: string) => ({
            id, pactId: PACT_ID, userId: SENDER, text: id, createdAt,
        });
        const checkin = (id: string, occurredAt: string) => ({
            id, pactId: OLD_CYCLE_ID, userId: PARTNER, habitGoalId: HABIT_GOAL_ID, hasProof: true, occurredAt,
        });

        it('interleaves messages and check-ins newest first and attaches reactions', () => {
            const { items, hasMore } = mergeTimeline(
                [message('m1', '2026-10-29T10:00:00Z'), message('m2', '2026-10-29T12:00:00Z')],
                [checkin('c1', '2026-10-29T11:00:00Z')],
                [{
                    targetId: 'c1', targetKind: 'checkin', userId: SENDER, emoji: '💪',
                }],
                10,
            );

            expect(items.map((item) => item.id)).to.deep.equal(['m2', 'c1', 'm1']);
            expect(items[1].kind).to.equal('checkin');
            expect(items[1].checkin?.hasProof).to.equal(true);
            expect(items[1].reactions).to.deep.equal([{ userId: SENDER, emoji: '💪' }]);
            expect(hasMore).to.equal(false);
        });

        it('cuts the page at the limit and says there is more', () => {
            const { items, hasMore } = mergeTimeline(
                [message('m1', '2026-10-29T10:00:00Z'), message('m2', '2026-10-29T12:00:00Z')],
                [checkin('c1', '2026-10-29T11:00:00Z')],
                [],
                2,
            );

            expect(items.map((item) => item.id)).to.deep.equal(['m2', 'c1']);
            expect(hasMore).to.equal(true);
        });

        it('a poll takes the oldest new items first, so a burst is never skipped, and still returns newest first', () => {
            const { items } = mergeTimeline(
                [message('m1', '2026-10-29T10:00:00Z'), message('m3', '2026-10-29T13:00:00Z')],
                [checkin('c1', '2026-10-29T11:00:00Z')],
                [],
                2,
                { isPolling: true },
            );

            expect(items.map((item) => item.id)).to.deep.equal(['c1', 'm1']);
        });
    });

    describe('POST /habits/pacts/:pactId/chat/messages', () => {
        let enqueue: sinon.SinonStub;
        let markRead: sinon.SinonStub;
        let createMessage: sinon.SinonStub;

        const stub = ({ pact = activePact(), isNew = true, members }: any = {}) => {
            sinon.stub(Store.pacts, 'getById').resolves(pact);
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member(SENDER));
            sinon.stub(Store.pactMembers, 'getByPactId').resolves(members || [
                member(SENDER),
                member(PARTNER),
                member(MUTED, { shouldMuteNotifs: true }),
                member(BLOCKER),
                member(INVITEE, { status: 'pending' }),
            ]);
            sinon.stub(Store.users, 'findUsers').resolves([
                { id: PARTNER, blockedUsers: [] },
                { id: BLOCKER, blockedUsers: [SENDER] },
            ] as any);
            sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Sam', userName: 'sam' }] as any);
            sinon.stub(Store.habitGoals, 'getById').resolves({ id: HABIT_GOAL_ID, name: 'Morning run' } as any);
            createMessage = sinon.stub(Store.pactChat, 'createMessage').resolves({
                message: {
                    id: MESSAGE_ID, pactId: PACT_ID, userId: SENDER, text: 'Done! 5k', createdAt: new Date('2026-10-29T14:05:00.000Z'),
                },
                isNew,
            });
            markRead = sinon.stub(Store.pactChat, 'markRead').resolves(1);
            enqueue = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'queue-row' } as any);
        };

        it('saves the message and queues one push per active, unmuted member who has not blocked the sender', async () => {
            stub();
            const result = await call(createPactMessage, { body: { text: '  Done! 5k  ' } });

            expect(result.statusCode).to.equal(201);
            expect(result.body.item).to.include({ id: MESSAGE_ID, kind: 'message', text: 'Done! 5k' });
            expect(createMessage.firstCall.args[0]).to.include({ pactId: PACT_ID, userId: SENDER, text: 'Done! 5k' });
            expect(markRead.calledOnce).to.equal(true);

            expect(enqueue.callCount).to.equal(1);
            const [brand, row] = enqueue.firstCall.args;
            expect(brand).to.equal('habits');
            expect(row.userId).to.equal(PARTNER);
            expect(row.type).to.equal(PushNotifications.Types.pactMessage);
            expect(row.dedupeKey).to.equal(`pact-message:${PACT_ID}:2026-10-29T14`);
            expect(row.scheduledFor.getTime()).to.equal(new Date('2026-10-29T14:05:00.000Z').getTime() + PACT_MESSAGE_PUSH_DELAY_MS);
            expect(row.payload).to.include({
                fromUserId: SENDER,
                fromUserName: 'Sam',
                habitName: 'Morning run',
                messagePreview: 'Done! 5k',
                pactId: PACT_ID,
                messageCreatedAt: '2026-10-29T14:05:00.000Z',
            });
        });

        it('a retried send (same clientMessageId) answers 200 and queues nothing new', async () => {
            stub({ isNew: false });
            const result = await call(createPactMessage, {
                body: { text: 'Done! 5k', clientMessageId: 'ffffffff-0000-4000-8000-000000000001' },
            });

            expect(result.statusCode).to.equal(200);
            expect(enqueue.called).to.equal(false);
            expect(markRead.called).to.equal(false);
        });

        it('rejects an empty or over-long message before touching the pact', async () => {
            const getById = sinon.stub(Store.pacts, 'getById');
            expect((await call(createPactMessage, { body: { text: '   ' } })).statusCode).to.equal(400);
            expect((await call(createPactMessage, { body: { text: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) } })).statusCode).to.equal(400);
            expect(getById.called).to.equal(false);
        });

        it('refuses a malformed clientMessageId', async () => {
            expect((await call(createPactMessage, { body: { text: 'hi', clientMessageId: 'nope' } })).statusCode).to.equal(400);
        });

        it('is read-only once the pact has ended', async () => {
            stub({ pact: activePact({ status: 'expired' }) });
            const result = await call(createPactMessage, { body: { text: 'hi' } });

            expect(result.statusCode).to.equal(403);
            expect(createMessage.called).to.equal(false);
        });

        it('still answers 201 when the queue is down', async () => {
            stub();
            enqueue.rejects(new Error('write pool exhausted'));
            const result = await call(createPactMessage, { body: { text: 'hi' } });

            expect(result.statusCode).to.equal(201);
        });
    });

    describe('GET /habits/pacts/:pactId/chat', () => {
        it('refuses a pending invitee', async () => {
            sinon.stub(Store.pacts, 'getById').resolves(activePact());
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member(INVITEE, { status: 'pending' }));
            const getMessages = sinon.stub(Store.pactChat, 'getMessages');

            const result = await call(getPactChat, { userId: INVITEE });

            expect(result.statusCode).to.equal(403);
            expect(getMessages.called).to.equal(false);
        });

        it('404s an id that is not a uuid instead of letting Postgres throw', async () => {
            const result = await call(getPactChat, { params: { pactId: 'not-a-uuid' } });
            expect(result.statusCode).to.equal(404);
        });

        it('reads the whole renewal chain and leaves out what the viewer blocked', async () => {
            sinon.stub(Store.pacts, 'getById').resolves(activePact());
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member(SENDER, { chatLastReadAt: '2026-10-29T09:00:00Z' }));
            sinon.stub(Store.pactChat, 'getThreadPactIds').resolves([PACT_ID, OLD_CYCLE_ID]);
            sinon.stub(Store.users, 'findUser').resolves([{ blockedUsers: [BLOCKER] }] as any);
            const getMessages = sinon.stub(Store.pactChat, 'getMessages').resolves([
                {
                    id: MESSAGE_ID, pactId: PACT_ID, userId: PARTNER, text: 'Morning!', createdAt: '2026-10-29T10:00:00Z',
                },
            ]);
            const getCheckins = sinon.stub(Store.pactChat, 'getCompletedCheckins').resolves([
                {
                    id: CHECKIN_ID, pactId: OLD_CYCLE_ID, userId: PARTNER, habitGoalId: HABIT_GOAL_ID, occurredAt: '2026-10-28T10:00:00Z',
                },
                {
                    id: 'dddddddd-0000-4000-8000-000000000009',
                    pactId: PACT_ID,
                    userId: BLOCKER,
                    habitGoalId: HABIT_GOAL_ID,
                    occurredAt: '2026-10-29T08:00:00Z',
                },
            ]);
            sinon.stub(Store.pactChat, 'getReactions').resolves([]);
            sinon.stub(Store.users, 'findUsers').resolves([{ id: PARTNER, firstName: 'Pat', userName: 'pat' }] as any);

            const result = await call(getPactChat, { query: { limit: '20' } });

            expect(result.statusCode).to.equal(200);
            expect(getMessages.firstCall.args[0]).to.deep.equal([PACT_ID, OLD_CYCLE_ID]);
            expect(getMessages.firstCall.args[2]).to.deep.equal({ viewerUserId: SENDER, excludeAuthorIds: [BLOCKER] });
            expect(getCheckins.firstCall.args[0]).to.deep.equal([PACT_ID, OLD_CYCLE_ID]);
            expect(result.body.items.map((item: any) => item.id)).to.deep.equal([MESSAGE_ID, CHECKIN_ID]);
            expect(result.body.users[PARTNER]).to.include({ firstName: 'Pat' });
            expect(result.body).to.include({ canPost: true, isMuted: false, lastReadAt: '2026-10-29T09:00:00Z' });
        });
    });

    describe('PUT /habits/pacts/:pactId/chat/reactions', () => {
        const stubAccess = () => {
            sinon.stub(Store.pacts, 'getById').resolves(activePact());
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member(SENDER));
            sinon.stub(Store.pactChat, 'getThreadPactIds').resolves([PACT_ID, OLD_CYCLE_ID]);
        };

        it('only takes a reaction from the curated set', async () => {
            const result = await call(setPactChatReaction, {
                body: { targetId: CHECKIN_ID, targetKind: 'checkin', emoji: '🍕' },
            });
            expect(result.statusCode).to.equal(400);
        });

        it('reacts to a check-in from an earlier cycle of the thread', async () => {
            stubAccess();
            sinon.stub(Store.habitCheckins, 'getById').resolves({ id: CHECKIN_ID, pactId: OLD_CYCLE_ID, status: 'completed' } as any);
            const setReaction = sinon.stub(Store.pactChat, 'setReaction').resolves({} as any);
            sinon.stub(Store.pactChat, 'getReactions').resolves([{
                targetId: CHECKIN_ID, targetKind: 'checkin', userId: SENDER, emoji: '💪',
            }]);

            const result = await call(setPactChatReaction, {
                body: { targetId: CHECKIN_ID, targetKind: 'checkin', emoji: '💪' },
            });

            expect(result.statusCode).to.equal(200);
            expect(setReaction.firstCall.args[0]).to.deep.equal({
                pactId: PACT_ID, userId: SENDER, targetKind: 'checkin', targetId: CHECKIN_ID, emoji: '💪',
            });
            expect(result.body.reactions).to.deep.equal([{ userId: SENDER, emoji: '💪' }]);
        });

        it('404s a target from another pact', async () => {
            stubAccess();
            sinon.stub(Store.pactChat, 'getMessageById').resolves({ id: MESSAGE_ID, pactId: 'some-other-pact' } as any);
            const setReaction = sinon.stub(Store.pactChat, 'setReaction');

            const result = await call(setPactChatReaction, {
                body: { targetId: MESSAGE_ID, targetKind: 'message', emoji: '🔥' },
            });

            expect(result.statusCode).to.equal(404);
            expect(setReaction.called).to.equal(false);
        });

        it('clears the reaction when emoji is null', async () => {
            stubAccess();
            sinon.stub(Store.pactChat, 'getMessageById').resolves({ id: MESSAGE_ID, pactId: PACT_ID } as any);
            const clearReaction = sinon.stub(Store.pactChat, 'clearReaction').resolves(1);
            sinon.stub(Store.pactChat, 'getReactions').resolves([]);

            const result = await call(setPactChatReaction, {
                body: { targetId: MESSAGE_ID, targetKind: 'message', emoji: null },
            });

            expect(result.statusCode).to.equal(200);
            expect(clearReaction.firstCall.args).to.deep.equal([MESSAGE_ID, SENDER]);
        });
    });

    describe('PUT /habits/pacts/:pactId/chat/messages/:messageId/report', () => {
        const stubAccess = (message: any) => {
            sinon.stub(Store.pacts, 'getById').resolves(activePact());
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member(SENDER));
            sinon.stub(Store.pactChat, 'getThreadPactIds').resolves([PACT_ID]);
            sinon.stub(Store.pactChat, 'getMessageById').resolves(message);
        };

        it('records the report on the message and on the author, like the existing report-user path', async () => {
            stubAccess({ id: MESSAGE_ID, pactId: PACT_ID, userId: PARTNER });
            const reportMessage = sinon.stub(Store.pactChat, 'reportMessage').resolves({} as any);
            sinon.stub(Store.users, 'findUser').resolves([{ id: PARTNER, wasReportedBy: ['someone-else'] }] as any);
            const updateUser = sinon.stub(Store.users, 'updateUser').resolves([] as any);

            const result = await call(reportPactMessage, { params: { pactId: PACT_ID, messageId: MESSAGE_ID } });

            expect(result.statusCode).to.equal(200);
            expect(reportMessage.firstCall.args).to.deep.equal([MESSAGE_ID, SENDER]);
            expect(updateUser.firstCall.args).to.deep.equal([{ wasReportedBy: ['someone-else', SENDER] }, { id: PARTNER }]);
        });

        it('will not report your own message', async () => {
            stubAccess({ id: MESSAGE_ID, pactId: PACT_ID, userId: SENDER });
            const reportMessage = sinon.stub(Store.pactChat, 'reportMessage');

            const result = await call(reportPactMessage, { params: { pactId: PACT_ID, messageId: MESSAGE_ID } });

            expect(result.statusCode).to.equal(400);
            expect(reportMessage.called).to.equal(false);
        });
    });

    describe('PUT /habits/pacts/:pactId/chat/mute', () => {
        it('writes the per-pact mute the partner check-in pushes already honour', async () => {
            sinon.stub(Store.pacts, 'getById').resolves(activePact());
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member(SENDER));
            const update = sinon.stub(Store.pactMembers, 'updateByPactAndUser').resolves({} as any);

            const result = await call(setPactChatMute, { body: { isMuted: true } });

            expect(result.statusCode).to.equal(200);
            expect(update.firstCall.args).to.deep.equal([PACT_ID, SENDER, { shouldMuteNotifs: true }]);
        });

        it('requires a boolean', async () => {
            expect((await call(setPactChatMute, { body: { isMuted: 'yes' } })).statusCode).to.equal(400);
        });
    });

    describe('attachUnreadMessageCounts', () => {
        it('adds a count per pact', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{ blockedUsers: [] }] as any);
            sinon.stub(Store.pactChat, 'countUnreadByPact').resolves({ [PACT_ID]: 3 });

            const pacts = await attachUnreadMessageCounts([{ id: PACT_ID }, { id: OLD_CYCLE_ID }], SENDER);

            expect(pacts).to.deep.equal([{ id: PACT_ID, unreadMessageCount: 3 }, { id: OLD_CYCLE_ID, unreadMessageCount: 0 }]);
        });

        it('returns the pacts untouched when the chat tables are not there yet', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{ blockedUsers: [] }] as any);
            sinon.stub(Store.pactChat, 'countUnreadByPact').rejects(new Error('relation "habits.pact_messages" does not exist'));

            const pacts = await attachUnreadMessageCounts([{ id: PACT_ID }], SENDER);

            expect(pacts).to.deep.equal([{ id: PACT_ID }]);
        });
    });

    describe('decidePactMessageFreshness', () => {
        const at = '2026-10-29T14:05:00.000Z';

        it('sends to an active member who has not read past the message', () => {
            expect(decidePactMessageFreshness({ status: 'active', chatLastReadAt: null }, at).shouldSend).to.equal(true);
            expect(decidePactMessageFreshness({ status: 'active', chatLastReadAt: '2026-10-29T14:00:00Z' }, at).shouldSend).to.equal(true);
        });

        it('skips once the recipient has read the thread', () => {
            expect(decidePactMessageFreshness({ status: 'active', chatLastReadAt: '2026-10-29T14:06:00Z' }, at))
                .to.deep.equal({ shouldSend: false, reason: 'already-read' });
        });

        it('skips a member who muted the pact or left it while the push waited', () => {
            expect(decidePactMessageFreshness({ status: 'active', shouldMuteNotifs: true }, at).reason).to.equal('pact-muted');
            expect(decidePactMessageFreshness({ status: 'left' }, at).reason).to.equal('no-longer-a-member');
            expect(decidePactMessageFreshness(undefined, at).reason).to.equal('no-longer-a-member');
        });
    });
});
