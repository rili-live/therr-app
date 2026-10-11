import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { openDailyRewardChest } from '../../src/handlers/rewardChests';
import { getPendingRewardChest } from '../../src/handlers/helpers/dailyStreak';
import {
    getExpectedRewardXp,
    getRewardChestTier,
    REWARD_CHEST_ODDS,
    rollRewardChest,
} from '../../src/utilities/rewardChest';

describe('Reward chest — odds and roll', () => {
    it('keeps the expected value about one check-in, so luck cannot outrank effort', () => {
        // A daily habit kept all week earns 70 XP from check-ins alone; a week of standard chests
        // must stay well under that, and even a jackpot must be less than it.
        expect(getExpectedRewardXp('standard')).to.be.within(8, 12);
        expect(getExpectedRewardXp('boosted')).to.be.within(15, 25);
        const maxXp = Math.max(...Object.values(REWARD_CHEST_ODDS).flat().map((entry) => entry.maxXp));
        expect(maxXp).to.be.below(70);
    });

    it('boosted chests never land on a common', () => {
        expect(REWARD_CHEST_ODDS.boosted.some((entry) => entry.rarity === 'common')).to.equal(false);
    });

    it('maps the first weight bucket to common and the last to jackpot', () => {
        expect(rollRewardChest('standard', () => 0)).to.deep.equal({ tier: 'standard', rarity: 'common', rewardXp: 3 });
        // randomInt(totalWeight) → 99 is the last slot; then randomInt(1) → 0.
        const rolls = [99, 0];
        expect(rollRewardChest('standard', () => rolls.shift() as number)).to.deep.equal({
            tier: 'standard', rarity: 'jackpot', rewardXp: 50,
        });
    });

    it('rolls an amount inside the landed rarity range', () => {
        // 60 → first rare slot; max - 1 → top of the rare range.
        const rolls = [60, 5];
        expect(rollRewardChest('standard', () => rolls.shift() as number)).to.deep.equal({
            tier: 'standard', rarity: 'rare', rewardXp: 15,
        });
    });

    it('stays inside every range over many real-random rolls', () => {
        for (let i = 0; i < 2000; i += 1) {
            const roll = rollRewardChest(i % 2 ? 'boosted' : 'standard', (max) => Math.floor(Math.random() * max));
            const entry = REWARD_CHEST_ODDS[roll.tier].find((candidate) => candidate.rarity === roll.rarity);
            expect(entry, roll.rarity).to.not.equal(undefined);
            expect(roll.rewardXp).to.be.within(entry?.minXp as number, entry?.maxXp as number);
        }
    });

    it('boosts milestones and perfect weeks', () => {
        expect(getRewardChestTier({ isMilestone: false, isPerfectWeek: false })).to.equal('standard');
        expect(getRewardChestTier({ isMilestone: true, isPerfectWeek: false })).to.equal('boosted');
        expect(getRewardChestTier({ isMilestone: false, isPerfectWeek: true })).to.equal('boosted');
    });
});

describe('Reward chest — getPendingRewardChest', () => {
    const celebration = {
        kind: 'day' as const, streak: 3, isPerfectWeek: false, isNewLongest: false,
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_REWARD_CHESTS_ENABLED;
    });

    it('offers an unopened chest', async () => {
        sinon.stub(Store.rewardChests, 'get').resolves(null);
        expect(await getPendingRewardChest('u1', '2026-10-11', celebration)).to.deep.equal({ tier: 'standard', isOpened: false });
    });

    it('replays an already-opened chest', async () => {
        sinon.stub(Store.rewardChests, 'get').resolves({
            tier: 'standard', rarity: 'epic', rewardXp: 25,
        } as any);
        expect(await getPendingRewardChest('u1', '2026-10-11', celebration)).to.deep.equal({
            tier: 'standard', isOpened: true, rarity: 'epic', rewardXp: 25,
        });
    });

    it('drops the chest, not the celebration, when the read fails', async () => {
        sinon.stub(Store.rewardChests, 'get').rejects(new Error('relation does not exist'));
        expect(await getPendingRewardChest('u1', '2026-10-11', celebration)).to.equal(null);
    });

    it('offers nothing when switched off', async () => {
        process.env.HABIT_REWARD_CHESTS_ENABLED = 'false';
        const get = sinon.stub(Store.rewardChests, 'get');
        expect(await getPendingRewardChest('u1', '2026-10-11', celebration)).to.equal(null);
        expect(get.called).to.equal(false);
    });
});

describe('Reward chest — openDailyRewardChest', () => {
    const userId = '00000000-0000-0000-0000-000000000001';
    const today = '2026-10-11';
    let res: any;
    let claim: sinon.SinonStub;
    let incrementPoints: sinon.SinonStub;

    const buildReq = (body: any = { date: today, timeZone: 'America/Chicago' }) => ({
        headers: {
            'x-userid': userId,
            'x-brand-variation': 'habits',
            'x-localecode': 'en-us',
            'x-platform': 'mobile',
        },
        body,
    });

    const setup = ({ lastUpheldDate = today, existing = null as any, currentStreak = 4 } = {}) => {
        sinon.stub(Store.users, 'getUserById').resolves([{ id: userId, settingsTimezone: 'America/Chicago' }] as any);
        sinon.stub(Store.rewardChests, 'get').resolves(existing);
        sinon.stub(Store.userDailyStreaks, 'getOrCreate').resolves({
            userId,
            currentStreak,
            longestStreak: currentStreak,
            lastUpheldDate,
            lastEvaluatedDate: null,
            lastCelebratedDate: today,
            consecutivePerfectWeeks: 0,
            lastResetFromStreak: 0,
        });
        sinon.stub(Store.dailyStreakDays, 'getRange').resolves([]);
        claim = sinon.stub(Store.rewardChests, 'claim').callsFake(async (params) => ({
            id: 'chest-1', openedAt: new Date(), ...params,
        }) as any);
        incrementPoints = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([] as any);
    };

    beforeEach(() => {
        // Pin "now" to the middle of the user's local today.
        sinon.useFakeTimers({ now: new Date('2026-10-11T17:00:00Z'), toFake: ['Date'] });
        res = {
            status: sinon.stub().returnsThis(),
            send: sinon.stub().returnsThis(),
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    it('rolls, records, then pays the chest for an upheld today', async () => {
        setup();
        await openDailyRewardChest(buildReq() as any, res, () => null);

        expect(res.status.calledWith(201)).to.equal(true);
        const params = claim.firstCall.args[0];
        expect(params).to.include({
            userId, brandVariation: 'habits', source: 'daily-streak', sourceKey: today, tier: 'standard',
        });
        expect(incrementPoints.calledOnce).to.equal(true);
        expect(incrementPoints.firstCall.args[0]).to.equal('habits');
        expect(incrementPoints.firstCall.args[3]).to.equal(params.rewardXp);
        expect(res.send.firstCall.args[0]).to.include({ alreadyOpened: false, rewardXp: params.rewardXp });
    });

    it('uses boosted odds on a streak milestone', async () => {
        setup({ currentStreak: 7 });
        await openDailyRewardChest(buildReq() as any, res, () => null);
        expect(claim.firstCall.args[0].tier).to.equal('boosted');
    });

    it('replays an opened chest and pays nothing', async () => {
        setup({
            existing: {
                id: 'chest-0', tier: 'standard', rarity: 'rare', rewardXp: 12,
            },
        });
        await openDailyRewardChest(buildReq() as any, res, () => null);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res.send.firstCall.args[0]).to.include({ alreadyOpened: true, rewardXp: 12 });
        expect(claim.called).to.equal(false);
        expect(incrementPoints.called).to.equal(false);
    });

    it('pays nothing when a concurrent open wins the insert', async () => {
        setup();
        claim.resolves(null);
        (Store.rewardChests.get as sinon.SinonStub).onSecondCall().resolves({ id: 'chest-0', rewardXp: 30 });
        await openDailyRewardChest(buildReq() as any, res, () => null);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res.send.firstCall.args[0]).to.include({ alreadyOpened: true, rewardXp: 30 });
        expect(incrementPoints.called).to.equal(false);
    });

    it('refuses a day that was not upheld', async () => {
        setup({ lastUpheldDate: '2026-10-10' });
        await openDailyRewardChest(buildReq() as any, res, () => null);
        expect(res.status.calledWith(409)).to.equal(true);
        expect(claim.called).to.equal(false);
    });

    it('refuses a chest older than yesterday even if it was the last upheld day', async () => {
        setup({ lastUpheldDate: '2026-10-08' });
        await openDailyRewardChest(buildReq({ date: '2026-10-08' }) as any, res, () => null);
        expect(res.status.calledWith(409)).to.equal(true);
    });

    it('clamps a future date to the local today', async () => {
        setup();
        await openDailyRewardChest(buildReq({ date: '2026-12-25', timeZone: 'America/Chicago' }) as any, res, () => null);
        expect(claim.firstCall.args[0].sourceKey).to.equal(today);
    });

    it('rejects a missing date', async () => {
        setup();
        await openDailyRewardChest(buildReq({}) as any, res, () => null);
        expect(res.status.calledWith(400)).to.equal(true);
    });
});
