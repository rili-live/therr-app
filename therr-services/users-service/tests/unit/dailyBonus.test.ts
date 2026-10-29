import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { awardDailyBonus, getDailyBonusForDay } from '../../src/handlers/helpers/dailyBonus';
import {
    getExpectedBonusXp,
    getDailyBonusTier,
    isComebackCheckin,
    DAILY_BONUS_ODDS,
    rollDailyBonus,
} from '../../src/utilities/dailyBonus';

describe('Daily bonus — odds and roll', () => {
    it('keeps the expected value about one check-in, so luck cannot outrank effort', () => {
        // A daily habit kept all week earns 70 XP from check-ins alone; a week of standard
        // bonuses must stay well under that, and even a jackpot must be less than it.
        expect(getExpectedBonusXp('standard')).to.be.within(8, 12);
        expect(getExpectedBonusXp('boosted')).to.be.within(15, 25);
        const maxXp = Math.max(...Object.values(DAILY_BONUS_ODDS).flat().map((entry) => entry.maxXp));
        expect(maxXp).to.be.below(70);
    });

    it('boosted bonuses never land on a common', () => {
        expect(DAILY_BONUS_ODDS.boosted.some((entry) => entry.rarity === 'common')).to.equal(false);
    });

    it('maps the first weight bucket to common and the last to jackpot', () => {
        expect(rollDailyBonus('standard', () => 0)).to.deep.equal({ tier: 'standard', rarity: 'common', bonusXp: 3 });
        // randomInt(totalWeight) → 99 is the last slot; then randomInt(1) → 0.
        const rolls = [99, 0];
        expect(rollDailyBonus('standard', () => rolls.shift() as number)).to.deep.equal({
            tier: 'standard', rarity: 'jackpot', bonusXp: 50,
        });
    });

    it('rolls an amount inside the landed rarity range', () => {
        // 60 → first rare slot; max - 1 → top of the rare range.
        const rolls = [60, 5];
        expect(rollDailyBonus('standard', () => rolls.shift() as number)).to.deep.equal({
            tier: 'standard', rarity: 'rare', bonusXp: 15,
        });
    });

    it('stays inside every range over many real-random rolls', () => {
        for (let i = 0; i < 2000; i += 1) {
            const roll = rollDailyBonus(i % 2 ? 'boosted' : 'standard', (max) => Math.floor(Math.random() * max));
            const entry = DAILY_BONUS_ODDS[roll.tier].find((candidate) => candidate.rarity === roll.rarity);
            expect(entry, roll.rarity).to.not.equal(undefined);
            expect(roll.bonusXp).to.be.within(entry?.minXp as number, entry?.maxXp as number);
        }
    });

    it('boosts milestones and perfect weeks', () => {
        expect(getDailyBonusTier({ isMilestone: false, isPerfectWeek: false })).to.equal('standard');
        expect(getDailyBonusTier({ isMilestone: true, isPerfectWeek: false })).to.equal('boosted');
        expect(getDailyBonusTier({ isMilestone: false, isPerfectWeek: true })).to.equal('boosted');
    });

    it('pays a visible comeback bonus — epic or better — that still cannot outrank consistency', () => {
        expect(DAILY_BONUS_ODDS.comeback.every((entry) => entry.rarity === 'epic' || entry.rarity === 'jackpot')).to.equal(true);
        // Earning one takes days of not checking in. Four consistent days earn ~40 XP of daily
        // bonuses on top of their check-ins; one comeback must stay under that.
        expect(getExpectedBonusXp('comeback')).to.be.within(20, 40);
        expect(getDailyBonusTier({ isMilestone: true, isPerfectWeek: false, isComeback: true })).to.equal('comeback');
    });

    it('calls a check-in a comeback only after a real gap, and never the first one ever', () => {
        expect(isComebackCheckin(null, '2026-10-08', 3)).to.equal(false);
        expect(isComebackCheckin('2026-10-07', '2026-10-08', 3)).to.equal(false);
        expect(isComebackCheckin('2026-10-06', '2026-10-08', 3)).to.equal(false);
        expect(isComebackCheckin('2026-10-05', '2026-10-08', 3)).to.equal(true);
        expect(isComebackCheckin('2026-09-01', '2026-10-08', 3)).to.equal(true);
    });
});

describe('Daily bonus — awardDailyBonus (paid at check-in, no tapping required)', () => {
    const userId = '00000000-0000-0000-0000-000000000001';
    // 2026-10-08 is a Thursday, so no perfect-week read.
    const localDate = '2026-10-08';
    const habitsHeaders = {
        'x-userid': userId, 'x-brand-variation': 'habits', 'x-localecode': 'en-us', 'x-platform': 'mobile',
    } as any;
    const state = {
        userId,
        currentStreak: 4,
        longestStreak: 4,
        lastUpheldDate: localDate,
        lastEvaluatedDate: null,
        lastCelebratedDate: null,
        consecutivePerfectWeeks: 0,
        lastResetFromStreak: 0,
    };
    let claim: sinon.SinonStub;
    let incrementPoints: sinon.SinonStub;

    beforeEach(() => {
        claim = sinon.stub(Store.dailyBonuses, 'claim').callsFake(async (params) => ({
            id: 'bonus-1', awardedAt: new Date(), ...params,
        }) as any);
        incrementPoints = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([] as any);
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_DAILY_BONUS_ENABLED;
    });

    it('rolls, records, then pays the bonus onto the Habits leaderboard', async () => {
        const view = await awardDailyBonus(userId, localDate, state, habitsHeaders);

        const params = claim.firstCall.args[0];
        expect(params).to.include({
            userId, brandVariation: 'habits', source: 'daily-streak', sourceKey: localDate, tier: 'standard',
        });
        expect(incrementPoints.calledOnce).to.equal(true);
        expect(incrementPoints.firstCall.args[0]).to.equal('habits');
        expect(incrementPoints.firstCall.args[3]).to.equal(params.bonusXp);
        expect(view).to.deep.equal({ tier: 'standard', rarity: params.rarity, bonusXp: params.bonusXp });
    });

    it('uses boosted odds on a streak milestone', async () => {
        await awardDailyBonus(userId, localDate, { ...state, currentStreak: 7 }, habitsHeaders);
        expect(claim.firstCall.args[0].tier).to.equal('boosted');
    });

    it('uses boosted odds on the Sunday that completes a perfect week', async () => {
        const sunday = '2026-10-11';
        const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', sunday]
            .map((date) => ({ localDate: date, status: 'upheld' }));
        sinon.stub(Store.dailyStreakDays, 'getRange').resolves(week as any);
        await awardDailyBonus(userId, sunday, { ...state, lastUpheldDate: sunday }, habitsHeaders);
        expect(claim.firstCall.args[0].tier).to.equal('boosted');
    });

    it('uses comeback odds on the first check-in after a lapse', async () => {
        await awardDailyBonus(userId, localDate, { ...state, currentStreak: 1 }, habitsHeaders, '2026-10-01');
        expect(claim.firstCall.args[0].tier).to.equal('comeback');
    });

    it('honours HABIT_LAPSE_BACKOFF_DAYS, so the comeback message and the bonus agree', async () => {
        process.env.HABIT_LAPSE_BACKOFF_DAYS = '10';
        try {
            await awardDailyBonus(userId, localDate, { ...state, currentStreak: 1 }, habitsHeaders, '2026-10-01');
            expect(claim.firstCall.args[0].tier).to.equal('standard');
        } finally {
            delete process.env.HABIT_LAPSE_BACKOFF_DAYS;
        }
    });

    it('pays nothing when the day already has a bonus', async () => {
        claim.resolves(null);
        expect(await awardDailyBonus(userId, localDate, state, habitsHeaders)).to.equal(null);
        expect(incrementPoints.called).to.equal(false);
    });

    it('is Friends with Habits only', async () => {
        await awardDailyBonus(userId, localDate, state, { ...habitsHeaders, 'x-brand-variation': 'therr' });
        expect(claim.called).to.equal(false);
    });

    it('does nothing when switched off', async () => {
        process.env.HABIT_DAILY_BONUS_ENABLED = 'false';
        await awardDailyBonus(userId, localDate, state, habitsHeaders);
        expect(claim.called).to.equal(false);
    });

    it('never throws, so a failure cannot fail the check-in', async () => {
        claim.rejects(new Error('relation "habits.daily_bonuses" does not exist'));
        expect(await awardDailyBonus(userId, localDate, state, habitsHeaders)).to.equal(null);
    });
});

describe('Daily bonus — getDailyBonusForDay', () => {
    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_DAILY_BONUS_ENABLED;
    });

    it('returns the paid bonus for the celebration to reveal', async () => {
        sinon.stub(Store.dailyBonuses, 'get').resolves({ tier: 'boosted', rarity: 'epic', bonusXp: 25 } as any);
        expect(await getDailyBonusForDay('u1', '2026-10-11')).to.deep.equal({ tier: 'boosted', rarity: 'epic', bonusXp: 25 });
    });

    it('returns null when there is none', async () => {
        sinon.stub(Store.dailyBonuses, 'get').resolves(null);
        expect(await getDailyBonusForDay('u1', '2026-10-11')).to.equal(null);
    });

    it('drops the reveal, not the celebration, when the read fails', async () => {
        sinon.stub(Store.dailyBonuses, 'get').rejects(new Error('boom'));
        expect(await getDailyBonusForDay('u1', '2026-10-11')).to.equal(null);
    });

    it('reads nothing when switched off', async () => {
        process.env.HABIT_DAILY_BONUS_ENABLED = 'false';
        const get = sinon.stub(Store.dailyBonuses, 'get');
        expect(await getDailyBonusForDay('u1', '2026-10-11')).to.equal(null);
        expect(get.called).to.equal(false);
    });
});
