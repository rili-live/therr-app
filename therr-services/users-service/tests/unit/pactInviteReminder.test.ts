import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    pactInviteReminderDedupeKey,
    runPactInviteReminderPass,
} from '../../src/handlers/helpers/pactInviteReminderDigest';
import evaluateCheckinNudgeFreshness from '../../src/utilities/checkinNudgeFreshness';
import { UNCAPPABLE_TYPES } from '../../src/utilities/notificationQueueWorker';

/**
 * The pact invite reminder.
 *
 * An invitee already on Habits got one push about a friend's pact and nothing after it; in
 * production 27 of 28 unanswered invitees were exactly that case, while an accepted pact was the
 * strongest predictor of checking in at all. The pass re-sends the invitation push once, and the
 * send-time gate keeps it from arriving after the invite has closed.
 */
describe('pact invite reminder — the digest pass', () => {
    const NOW = new Date('2026-10-08T14:00:00Z');

    const invite = (overrides: any = {}) => ({
        pactMemberId: 'member-1',
        pactId: 'pact-1',
        inviteeUserId: 'invitee-1',
        habitGoalName: 'Morning run',
        creatorUserId: 'creator-1',
        ...overrides,
    });

    let queuePush: sinon.SinonStub;
    let readInvites: sinon.SinonStub;

    const stub = ({
        invites = [invite()],
        deviceUserIds = ['invitee-1'],
        preferences = {},
        outcome = 'queued',
        creatorRows = [{ firstName: 'Cam', userName: 'cam' }],
    }: any = {}) => {
        readInvites = sinon.stub(Store.pactMembers, 'getUnansweredInvitesForReminder').resolves(invites);
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers')
            .resolves(deviceUserIds.map((userId: string) => ({ userId, token: 't' })) as any);
        sinon.stub(Store.users, 'getHabitReminderPreferences').resolves(preferences);
        sinon.stub(Store.users, 'findUser').resolves(creatorRows as any);
        queuePush = sinon.stub().resolves(outcome);
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_PACT_INVITE_REMINDERS_ENABLED;
    });

    it('reads invites 1 to 14 days old for the pinned brand', async () => {
        stub({ invites: [] });
        await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        const [brand, before, after] = readInvites.firstCall.args;
        expect(brand).to.equal(BrandVariations.HABITS);
        expect(before.toISOString()).to.equal('2026-10-07T14:00:00.000Z');
        expect(after.toISOString()).to.equal('2026-09-24T14:00:00.000Z');
    });

    it('re-queues the invitation push with everything its copy and Accept action need', async () => {
        stub();
        const counters = await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        expect(counters.remindersQueued).to.equal(1);
        const [toUserId, type, dedupeKey, extras] = queuePush.firstCall.args;
        expect(toUserId).to.equal('invitee-1');
        expect(type).to.equal(PushNotifications.Types.pactInvitation);
        expect(dedupeKey).to.equal('pact-invite-reminder:member-1');
        expect(extras).to.deep.include({
            fromUser: { id: 'creator-1', userName: 'Cam' },
            fromUserId: 'creator-1',
            pactId: 'pact-1',
            pactMemberId: 'member-1',
            habitName: 'Morning run',
        });
    });

    // Most creators on unanswered pacts have no handle; the push must not read " invited you to …".
    it('names a creator with no first name or handle generically rather than leaving a blank', async () => {
        stub({ creatorRows: [{ firstName: null, userName: null }] });
        await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        expect(queuePush.firstCall.args[3].fromUser.userName).to.equal('Your partner');
    });

    it('dedupes once per invite, with nothing time-varying in the key', () => {
        expect(pactInviteReminderDedupeKey('member-1')).to.equal('pact-invite-reminder:member-1');
    });

    it('counts a second run as deduped rather than queued', async () => {
        stub({ outcome: 'duplicate' });
        const counters = await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        expect(counters.remindersQueued).to.equal(0);
        expect(counters.remindersDeduped).to.equal(1);
    });

    it('queues nothing for an invitee with no device on the brand, or who muted habit reminders', async () => {
        stub({
            invites: [invite(), invite({ pactMemberId: 'member-2', inviteeUserId: 'invitee-2' })],
            deviceUserIds: ['invitee-2'],
            preferences: { 'invitee-2': { settingsPushHabitReminders: false } },
        });
        const counters = await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        expect(counters.remindersNoChannel).to.equal(2);
        expect(queuePush.called).to.equal(false);
    });

    it('reminds an invitee about one invite per run, the oldest', async () => {
        stub({ invites: [invite(), invite({ pactMemberId: 'member-2', pactId: 'pact-2' })] });
        const counters = await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        expect(counters.remindersQueued).to.equal(1);
        expect(counters.remindersDeferredSameUser).to.equal(1);
        expect(queuePush.firstCall.args[2]).to.equal('pact-invite-reminder:member-1');
    });

    it('does nothing when switched off', async () => {
        process.env.HABIT_PACT_INVITE_REMINDERS_ENABLED = 'false';
        stub();
        const counters = await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        expect(readInvites.called).to.equal(false);
        expect(counters.invitesEvaluated).to.equal(0);
    });

    it('counts a failed enqueue as an error and carries on', async () => {
        stub({
            invites: [invite(), invite({ pactMemberId: 'member-2', inviteeUserId: 'invitee-2' })],
            deviceUserIds: ['invitee-1', 'invitee-2'],
        });
        queuePush.onFirstCall().rejects(new Error('boom'));
        const counters = await runPactInviteReminderPass(queuePush, BrandVariations.HABITS, NOW);

        expect(counters.reminderErrors).to.equal(1);
        expect(counters.remindersQueued).to.equal(1);
    });
});

describe('pact invite reminder — at send time', () => {
    const row = (payload: any = { pactMemberId: 'member-1', pactId: 'pact-1' }): any => ({
        id: 'row-1',
        userId: 'invitee-1',
        brandVariation: BrandVariations.HABITS,
        type: PushNotifications.Types.pactInvitation,
        dedupeKey: 'pact-invite-reminder:member-1',
        payload,
        createdAt: new Date(),
    });

    afterEach(() => {
        sinon.restore();
    });

    it('sends while the invite can still be accepted', async () => {
        const read = sinon.stub(Store.pactMembers, 'isInviteOpen').resolves(true);

        expect((await evaluateCheckinNudgeFreshness(row())).shouldSend).to.equal(true);
        expect(read.calledOnceWith('member-1')).to.equal(true);
    });

    it('drops a reminder whose invite was answered or ended while it waited', async () => {
        sinon.stub(Store.pactMembers, 'isInviteOpen').resolves(false);

        const decision = await evaluateCheckinNudgeFreshness(row());
        expect(decision.shouldSend).to.equal(false);
        expect(decision.reason).to.equal('invite-no-longer-open');
    });

    it('fails open when the read fails, and passes a row with no pactMemberId untouched', async () => {
        const read = sinon.stub(Store.pactMembers, 'isInviteOpen').rejects(new Error('db down'));

        expect((await evaluateCheckinNudgeFreshness(row())).shouldSend).to.equal(true);
        read.resetHistory();
        expect((await evaluateCheckinNudgeFreshness(row({ pactId: 'pact-1' }))).shouldSend).to.equal(true);
        expect(read.called).to.equal(false);
    });

    it('is never dropped by the daily cap, since its dateless key means no later row replaces it', () => {
        expect(UNCAPPABLE_TYPES.has(PushNotifications.Types.pactInvitation)).to.equal(true);
    });
});
