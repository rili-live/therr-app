import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { announceOpenedPact } from '../../src/handlers/helpers/openPactAnnouncement';
import {
    isOpenPactBonusEligible,
    LeaderboardXpValues,
    openPactCheckinBonusXp,
} from '../../src/utilities/leaderboardHelpers';
import { MAX_OPEN_PACT_MEMBERS, OPEN_PACT_ANNOUNCEMENT_MAX_RECIPIENTS, openPactAnnouncementDedupeKey } from '../../src/utilities/openPacts';

describe('open pacts — XP incentives', () => {
    it('pays the check-in bonus only on a running open pact someone joined', () => {
        expect(isOpenPactBonusEligible({ isOpen: true, status: 'active', isSolo: false })).to.equal(true);
        expect(isOpenPactBonusEligible({ isOpen: true, status: 'active', isSolo: null })).to.equal(true);
        // Opened, nobody joined yet.
        expect(isOpenPactBonusEligible({ isOpen: true, status: 'pending' })).to.equal(false);
        // Everyone else left and the creator carried on alone.
        expect(isOpenPactBonusEligible({ isOpen: true, status: 'active', isSolo: true })).to.equal(false);
        expect(isOpenPactBonusEligible({ isOpen: false, status: 'active' })).to.equal(false);
        expect(isOpenPactBonusEligible(undefined)).to.equal(false);
    });

    it('pays the bonus once per check-in however many open pacts it counts toward', () => {
        const open = { isOpen: true, status: 'active' };
        expect(openPactCheckinBonusXp([open, open])).to.equal(LeaderboardXpValues.openPactCheckinBonus);
        expect(openPactCheckinBonusXp([{ isOpen: false, status: 'active' }])).to.equal(0);
        expect(openPactCheckinBonusXp([])).to.equal(0);
    });
});

describe('open pacts — the first-open announcement', () => {
    const NOW = new Date('2026-11-13T15:00:00Z');
    const headers = { 'x-userid': 'creator-1', 'x-brand-variation': BrandVariations.HABITS };
    const pact = {
        id: 'pact-1', creatorUserId: 'creator-1', habitGoalId: 'goal-1', isOpen: true, status: 'pending', endDate: null,
    };

    const prospect = (userId: string, overrides: any = {}) => ({
        userId,
        settingsLocale: 'es',
        settingsTimezone: 'America/Chicago',
        settingsQuietHoursStart: null,
        settingsQuietHoursEnd: null,
        settingsPreferredReminderTime: null,
        settingsPreferredEveningReminderTime: null,
        ...overrides,
    });

    let claim: sinon.SinonStub;
    let enqueue: sinon.SinonStub;
    let incrementPoints: sinon.SinonStub;
    let getProspects: sinon.SinonStub;

    const stub = ({
        claimed = true,
        seats = 1,
        prospects = [prospect('u-1'), prospect('u-2')],
        deviceUserIds = ['u-1', 'u-2'],
    }: any = {}) => {
        sinon.stub(Store.pacts, 'countSeats').resolves(seats);
        claim = sinon.stub(Store.pacts, 'claimFirstOpen').resolves(claimed);
        sinon.stub(Store.habitGoals, 'getById').resolves({
            id: 'goal-1', name: 'Morning run', templateKey: 'run',
        } as any);
        getProspects = sinon.stub(Store.pacts, 'getInterestedUsersForOpenPact').resolves(prospects);
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers')
            .resolves(deviceUserIds.map((userId: string) => ({ userId, token: 't' })) as any);
        enqueue = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'q' } as any);
        incrementPoints = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([] as any);
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_OPEN_PACT_ANNOUNCEMENTS_ENABLED;
    });

    it('queues one Habits push per reachable person on the same habit, keyed per recipient per day', async () => {
        stub();
        const result = await announceOpenedPact(headers, pact, NOW);

        expect(result).to.include({ claimed: true, candidates: 2, queued: 2 });
        expect(getProspects.firstCall.args[0]).to.equal('pact-1');
        expect(getProspects.firstCall.args[1]).to.deep.equal({ templateKey: 'run', normalizedName: 'morning run' });
        expect(enqueue.callCount).to.equal(2);
        const [brand, row] = enqueue.firstCall.args;
        expect(brand).to.equal(BrandVariations.HABITS);
        expect(row.type).to.equal(PushNotifications.Types.openPactAvailable);
        expect(row.dedupeKey).to.equal('open-pact-available:2026-11-13');
        expect(row.payload).to.include({
            pactId: 'pact-1', habitGoalId: 'goal-1', habitName: 'Morning run', locale: 'es',
        });
    });

    it('pays the creator for opening, once', async () => {
        stub();
        await announceOpenedPact(headers, pact, NOW);

        expect(incrementPoints.calledOnce).to.equal(true);
        const [, userId, , points] = incrementPoints.firstCall.args;
        expect(userId).to.equal('creator-1');
        expect(points).to.equal(LeaderboardXpValues.openPactOpened);
    });

    it('does nothing at all on a re-open — the claim was already taken', async () => {
        stub({ claimed: false });
        const result = await announceOpenedPact(headers, pact, NOW);

        expect(result.claimed).to.equal(false);
        expect(enqueue.called).to.equal(false);
        expect(incrementPoints.called).to.equal(false);
    });

    it('announces nothing, and claims nothing, when the pact has no seat left', async () => {
        stub({ seats: MAX_OPEN_PACT_MEMBERS });
        await announceOpenedPact(headers, pact, NOW);

        expect(claim.called).to.equal(false);
        expect(enqueue.called).to.equal(false);
    });

    it('skips people with no Habits app to receive it, and caps the recipients', async () => {
        const many = Array.from({ length: OPEN_PACT_ANNOUNCEMENT_MAX_RECIPIENTS + 10 }, (_, i) => prospect(`u-${i}`));
        stub({ prospects: [prospect('no-device'), ...many], deviceUserIds: many.map((p) => p.userId) });
        const result = await announceOpenedPact(headers, pact, NOW);

        expect(result.queued).to.equal(OPEN_PACT_ANNOUNCEMENT_MAX_RECIPIENTS);
        expect(enqueue.getCalls().map((call) => call.args[1].userId)).to.not.include('no-device');
    });

    it('holds the push for a recipient in quiet hours until their morning', async () => {
        // 03:00 in Chicago.
        const night = new Date('2026-11-13T09:00:00Z');
        stub({ prospects: [prospect('u-1')], deviceUserIds: ['u-1'] });
        await announceOpenedPact(headers, pact, night);

        const { scheduledFor } = enqueue.firstCall.args[1];
        expect(scheduledFor).to.be.instanceOf(Date);
        expect(scheduledFor.getTime()).to.be.greaterThan(night.getTime());
    });

    it('still pays the creator when the push is switched off', async () => {
        process.env.HABIT_OPEN_PACT_ANNOUNCEMENTS_ENABLED = 'false';
        stub();
        await announceOpenedPact(headers, pact, NOW);

        expect(incrementPoints.calledOnce).to.equal(true);
        expect(enqueue.called).to.equal(false);
    });

    it('never throws', async () => {
        stub();
        (Store.pacts.getInterestedUsersForOpenPact as sinon.SinonStub).rejects(new Error('db down'));
        const result = await announceOpenedPact(headers, pact, NOW);

        expect(result.claimed).to.equal(true);
        expect(result.queued).to.equal(0);
    });

    it('carries the day, never the pact, in the dedupe key', () => {
        expect(openPactAnnouncementDedupeKey(NOW)).to.equal('open-pact-available:2026-11-13');
    });
});
