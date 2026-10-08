import { expect } from 'chai';
import sinon from 'sinon';
import {
    AccessLevels, BrandVariations, HABITS_LIFETIME_FOUNDER_LIMIT, PushNotifications,
} from 'therr-js-utilities/constants';
import Store from '../../src/store';
import * as firstHabitEmailModule from '../../src/api/email/for-social/sendFirstHabitNudgeEmail';
import * as seatReminderEmailModule from '../../src/api/email/for-social/sendPactSeatReminderEmail';
import {
    FOUNDER_OFFER_MESSAGE_KEY,
    NO_HABIT_MESSAGE_KEY,
    runOnboardingNurturePass,
} from '../../src/handlers/helpers/onboardingNurtureDigest';
import { UNCAPPABLE_TYPES } from '../../src/utilities/notificationQueueWorker';

/**
 * The Habits onboarding nurture sequence (#3011).
 *
 * Every other digest pass reads existing habits or pacts, so an account that stalled before its
 * first habit got nothing at all. The rules that matter: each message goes to a user once,
 * whichever channel carries it (claimed before sending); a push is preferred, an email is the
 * fallback only where the message has one; and a setting that says no is honoured.
 */
describe('onboarding nurture — the digest pass', () => {
    const NOW = new Date('2026-10-08T14:00:00Z');
    const context = { brandVariation: BrandVariations.HABITS, whiteLabelOrigin: '' };

    let queuePush: sinon.SinonStub;
    let claim: sinon.SinonStub;
    let noHabit: sinon.SinonStub;
    let emailSeats: sinon.SinonStub;
    let founder: sinon.SinonStub;
    let founderSlots: sinon.SinonStub;
    let firstHabitEmail: sinon.SinonStub;
    let seatEmail: sinon.SinonStub;

    const stub = ({
        noHabitRows = [] as any[],
        seatRows = [] as any[],
        emailSeatRows = [] as any[],
        founderRows = [] as any[],
        deviceUserIds = [] as string[],
        preferences = {},
        claimed = true,
    }: any = {}) => {
        noHabit = sinon.stub(Store.onboardingMessages, 'getNoHabitCandidates').resolves(noHabitRows);
        sinon.stub(Store.onboardingMessages, 'getUnclaimedSeatsForInviter').resolves(seatRows);
        emailSeats = sinon.stub(Store.onboardingMessages, 'getExpiringEmailSeats');
        emailSeats.onFirstCall().resolves(emailSeatRows);
        emailSeats.resolves([]);
        founder = sinon.stub(Store.onboardingMessages, 'getFounderOfferCandidates').resolves(founderRows);
        founderSlots = sinon.stub(Store.lifetimePurchases, 'countClaimedFounderSlots').resolves(10);
        claim = sinon.stub(Store.onboardingMessages, 'claim').resolves(claimed);
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers')
            .callsFake(async (_brand: any, ids: string[]) => ids.filter((id) => deviceUserIds.includes(id))
                .map((userId) => ({ userId, token: 't' })) as any);
        sinon.stub(Store.users, 'getHabitReminderPreferences').resolves(preferences);
        sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Cam', userName: 'cam' }] as any);
        firstHabitEmail = sinon.stub(firstHabitEmailModule, 'default').resolves({} as any);
        seatEmail = sinon.stub(seatReminderEmailModule, 'default').resolves({} as any);
        queuePush = sinon.stub().resolves('queued');
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_ONBOARDING_NURTURE_ENABLED;
    });

    describe('the no-habit nudge', () => {
        const account = (overrides: any = {}) => ({
            userId: 'new-1',
            email: 'new@example.com',
            firstName: 'Nia',
            userName: null,
            isUnclaimed: false,
            settingsEmailReminders: true,
            settingsLocale: 'es',
            ...overrides,
        });

        it('reads accounts 24 hours to 7 days old', async () => {
            stub();
            await runOnboardingNurturePass(queuePush, context, NOW);

            const [brand, key, before, after] = noHabit.firstCall.args;
            expect(brand).to.equal(BrandVariations.HABITS);
            expect(key).to.equal(NO_HABIT_MESSAGE_KEY);
            expect(before.toISOString()).to.equal('2026-10-07T14:00:00.000Z');
            expect(after.toISOString()).to.equal('2026-10-01T14:00:00.000Z');
        });

        it('pushes when the account has a Habits device, claiming the push channel first', async () => {
            stub({ noHabitRows: [account()], deviceUserIds: ['new-1'] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(claim.calledWith('new-1', NO_HABIT_MESSAGE_KEY, 'push')).to.equal(true);
            expect(claim.calledBefore(queuePush)).to.equal(true);
            expect(queuePush.firstCall.args.slice(0, 3)).to.deep.equal([
                'new-1', PushNotifications.Types.habitsFirstHabitNudge, NO_HABIT_MESSAGE_KEY,
            ]);
            expect(counters.noHabitNudge.queued).to.equal(1);
            expect(firstHabitEmail.called).to.equal(false);
        });

        it('emails an account with no device, in its own locale', async () => {
            stub({ noHabitRows: [account()] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(claim.calledWith('new-1', NO_HABIT_MESSAGE_KEY, 'email')).to.equal(true);
            expect(firstHabitEmail.firstCall.args[0]).to.include({ locale: 'es' });
            expect(firstHabitEmail.firstCall.args[0].toAddresses).to.deep.equal(['new@example.com']);
            expect(counters.noHabitNudge.emailed).to.equal(1);
        });

        it('falls back to email when habit pushes are muted, and skips an account that muted both', async () => {
            stub({
                noHabitRows: [account(), account({ userId: 'new-2', settingsEmailReminders: false })],
                deviceUserIds: ['new-1', 'new-2'],
                preferences: { 'new-1': { settingsPushHabitReminders: false }, 'new-2': { settingsPushHabitReminders: false } },
            });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.noHabitNudge.emailed).to.equal(1);
            expect(counters.noHabitNudge.noChannel).to.equal(1);
            expect(queuePush.called).to.equal(false);
        });

        it('sends nothing when the message was already claimed — a second run, a retry, a manual curl', async () => {
            stub({ noHabitRows: [account()], deviceUserIds: ['new-1'], claimed: false });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.noHabitNudge.deduped).to.equal(1);
            expect(queuePush.called).to.equal(false);
            expect(firstHabitEmail.called).to.equal(false);
        });
    });

    describe('the inviter resend prompt', () => {
        const seat = (overrides: any = {}) => ({
            pactMemberId: 'member-1',
            pactId: 'pact-1',
            creatorUserId: 'creator-1',
            inviteeUserId: 'invitee-1',
            habitGoalName: 'Morning run',
            ...overrides,
        });

        it('pushes the inviter once per seat, naming who has not joined', async () => {
            stub({ seatRows: [seat()], deviceUserIds: ['creator-1'] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(claim.calledWith('creator-1', 'seat:member-1:inviter-d1', 'push')).to.equal(true);
            const [toUserId, type, dedupeKey, extras] = queuePush.firstCall.args;
            expect(toUserId).to.equal('creator-1');
            expect(type).to.equal(PushNotifications.Types.pactInviteUnclaimed);
            expect(dedupeKey).to.equal('seat:member-1:inviter-d1');
            expect(extras).to.deep.equal({ pactId: 'pact-1', habitName: 'Morning run', partnerName: 'Cam' });
            expect(counters.inviterResend.queued).to.equal(1);
        });

        it('prompts an inviter about one seat per run, the oldest', async () => {
            stub({ seatRows: [seat(), seat({ pactMemberId: 'member-2' })], deviceUserIds: ['creator-1'] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.inviterResend.queued).to.equal(1);
            expect(counters.inviterResend.deferredSameUser).to.equal(1);
        });

        it('has no email fallback', async () => {
            stub({ seatRows: [seat()] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.inviterResend.noChannel).to.equal(1);
            expect(claim.called).to.equal(false);
        });
    });

    describe('the seat-expiry reminder', () => {
        const emailSeat = (overrides: any = {}) => ({
            pactMemberId: 'member-1',
            pactId: 'pact-1',
            creatorUserId: 'creator-1',
            inviteeUserId: 'invitee-1',
            habitGoalName: 'Morning run',
            claimToken: 'tok-1',
            claimCode: 'PACT-AB12',
            claimTokenExpiresAt: new Date('2026-10-15T12:00:00Z'),
            email: 'friend@example.com',
            firstName: 'Fran',
            isUnclaimed: false,
            settingsEmailInvites: true,
            settingsLocale: 'fr-ca',
            ...overrides,
        });

        it('reads 3–10 and 10–14 day old invites as separate reminders', async () => {
            stub();
            await runOnboardingNurturePass(queuePush, context, NOW);

            const [first, second] = emailSeats.getCalls().map((call) => call.args);
            expect(first[1].toISOString()).to.equal('2026-10-05T14:00:00.000Z');
            expect(first[2].toISOString()).to.equal('2026-09-28T14:00:00.000Z');
            expect(first[3]).to.equal('d3');
            expect(second[3]).to.equal('d10');
        });

        it('emails the claim link and code again, with the days left on the seat', async () => {
            stub({ emailSeatRows: [emailSeat()] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(claim.calledWith('invitee-1', 'seat:member-1:d3', 'email')).to.equal(true);
            const [emailParams, templateParams] = seatEmail.firstCall.args;
            expect(emailParams).to.include({ locale: 'fr-ca' });
            expect(templateParams).to.include({ fromName: 'Cam', claimCode: 'PACT-AB12', daysLeft: 7 });
            expect(templateParams.claimUrl).to.match(/\/claim-pact\/tok-1$/);
            expect(counters.seatReminders.emailed).to.equal(1);
        });

        it('honours an invitee who turned invite emails off', async () => {
            stub({ emailSeatRows: [emailSeat({ settingsEmailInvites: false })] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.seatReminders.noChannel).to.equal(1);
            expect(seatEmail.called).to.equal(false);
        });
    });

    describe('the founder offer', () => {
        const earner = (overrides: any = {}) => ({
            userId: 'earner-1',
            accessLevels: [],
            completedCheckins: 4,
            settingsPushMarketing: true,
            ...overrides,
        });

        it('pushes once to a week-old solo account with 3+ check-ins', async () => {
            stub({ founderRows: [earner()], deviceUserIds: ['earner-1'] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            const [, , minAge, minCheckins] = founder.firstCall.args;
            expect(minAge.toISOString()).to.equal('2026-10-01T14:00:00.000Z');
            expect(minCheckins).to.equal(3);
            expect(queuePush.firstCall.args.slice(0, 4)).to.deep.equal([
                'earner-1', PushNotifications.Types.habitsFounderOffer, FOUNDER_OFFER_MESSAGE_KEY, { checkinCount: 4 },
            ]);
            expect(counters.founderOffer.queued).to.equal(1);
        });

        it('is never offered to someone who already has it', async () => {
            stub({ founderRows: [earner({ accessLevels: [AccessLevels.HABITS_LIFETIME] })], deviceUserIds: ['earner-1'] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.founderOffer.skippedEntitled).to.equal(1);
            expect(queuePush.called).to.equal(false);
        });

        it('answers to the marketing push switch', async () => {
            stub({ founderRows: [earner({ settingsPushMarketing: false })], deviceUserIds: ['earner-1'] });
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.founderOffer.noChannel).to.equal(1);
            expect(queuePush.called).to.equal(false);
        });

        it('is not offered once founder spots are gone', async () => {
            stub({ founderRows: [earner()], deviceUserIds: ['earner-1'] });
            founderSlots.resolves(HABITS_LIFETIME_FOUNDER_LIMIT);
            const counters = await runOnboardingNurturePass(queuePush, context, NOW);

            expect(counters.founderOffer.skippedSoldOut).to.equal(true);
            expect(founder.called).to.equal(false);
        });
    });

    it('keeps going when one message fails', async () => {
        stub({
            seatRows: [{
                pactMemberId: 'm', pactId: 'p', creatorUserId: 'c', inviteeUserId: 'i', habitGoalName: 'Run',
            }],
            deviceUserIds: ['c'],
        });
        noHabit.rejects(new Error('db down'));
        const counters = await runOnboardingNurturePass(queuePush, context, NOW);

        expect(counters.noHabitNudge.errors).to.equal(1);
        expect(counters.inviterResend.queued).to.equal(1);
    });

    it('does nothing when switched off', async () => {
        process.env.HABIT_ONBOARDING_NURTURE_ENABLED = 'false';
        stub();
        await runOnboardingNurturePass(queuePush, context, NOW);

        expect(noHabit.called).to.equal(false);
        expect(founderSlots.called).to.equal(false);
    });

    // Each message is claimed once ever before it is queued, so a row the daily cap dropped would
    // never be queued again. The cap may delay these, never drop them.
    it('exempts every nurture push from the daily cap drop', () => {
        [
            PushNotifications.Types.habitsFirstHabitNudge,
            PushNotifications.Types.pactInviteUnclaimed,
            PushNotifications.Types.habitsFounderOffer,
        ].forEach((type) => {
            expect(UNCAPPABLE_TYPES.has(type)).to.equal(true);
        });
    });
});
