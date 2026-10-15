/**
 * Leaderboard XP for registering and for opening the app.
 *
 * Registration pays once, to the account just created, so a new user is on that week's board
 * before their first check-in. App opens pay a point each for the first APP_OPEN_XP_DAILY_LIMIT
 * of a UTC day; the cap is a Redis counter and must hold however many opens the client reports.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import { awsSES } from '../../src/api/aws';
import Store from '../../src/store';
import redisEphemeralClient, * as redisClient from '../../src/store/redisClient';
import { recordAppOpen } from '../../src/handlers/leaderboards';
import { createUserHelper } from '../../src/handlers/helpers/user';
import { APP_OPEN_XP_DAILY_LIMIT, LeaderboardXpValues, getLeaderboardPeriodStart } from '../../src/utilities/leaderboardHelpers';

const habitsHeaders = {
    'x-userid': 'user-1',
    'x-brand-variation': BrandVariations.HABITS,
    'x-platform': 'mobile',
    'x-localecode': 'en-us',
};

const mockResponse = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

describe('tryClaimAppOpenXp — daily cap', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('allows the first opens up to the limit and refuses the rest', async () => {
        let count = 0;
        sinon.stub(redisEphemeralClient, 'incr').callsFake(async () => {
            count += 1;
            return count;
        });
        const expireStub = sinon.stub(redisEphemeralClient, 'expire').resolves(1);

        const results: boolean[] = [];
        for (let i = 0; i < APP_OPEN_XP_DAILY_LIMIT + 2; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            results.push(await redisClient.tryClaimAppOpenXp('habits', 'user-1', '2026-10-14', APP_OPEN_XP_DAILY_LIMIT));
        }

        expect(results).to.deep.equal([true, true, true, false, false]);
        // The TTL is set once, when the day's key is created.
        expect(expireStub.calledOnce).to.equal(true);
    });

    it('keys the count by brand, user and UTC day', async () => {
        const incrStub = sinon.stub(redisEphemeralClient, 'incr').resolves(1);
        sinon.stub(redisEphemeralClient, 'expire').resolves(1);

        await redisClient.tryClaimAppOpenXp('habits', 'user-1', '2026-10-14', APP_OPEN_XP_DAILY_LIMIT);

        expect(incrStub.firstCall.args[0]).to.equal('leaderboard:app-open:habits:user-1:2026-10-14');
    });

    it('fails closed when Redis is unreachable', async () => {
        sinon.stub(redisEphemeralClient, 'incr').rejects(new Error('redis down'));

        expect(await redisClient.tryClaimAppOpenXp('habits', 'user-1', '2026-10-14', APP_OPEN_XP_DAILY_LIMIT)).to.equal(false);
    });
});

describe('recordAppOpen', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('pays one point onto the current week when the open is within the daily cap', async () => {
        const claimStub = sinon.stub(redisClient, 'tryClaimAppOpenXp').resolves(true);
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);
        const res = mockResponse();

        await recordAppOpen({ headers: habitsHeaders } as any, res, () => null);

        const [brand, userId, utcDate, limit] = claimStub.firstCall.args;
        expect(brand).to.equal(BrandVariations.HABITS);
        expect(userId).to.equal('user-1');
        expect(utcDate).to.equal(new Date().toISOString().split('T')[0]);
        expect(limit).to.equal(APP_OPEN_XP_DAILY_LIMIT);
        expect(incrementStub.calledOnceWith(BrandVariations.HABITS, 'user-1', getLeaderboardPeriodStart(), LeaderboardXpValues.appOpen))
            .to.equal(true);
        expect(res.status.calledWith(200)).to.equal(true);
        expect(res.send.firstCall.args[0]).to.deep.equal({ xpAwarded: LeaderboardXpValues.appOpen });
    });

    it('pays nothing past the daily cap, and still answers 200', async () => {
        sinon.stub(redisClient, 'tryClaimAppOpenXp').resolves(false);
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);
        const res = mockResponse();

        await recordAppOpen({ headers: habitsHeaders } as any, res, () => null);

        expect(incrementStub.called).to.equal(false);
        expect(res.status.calledWith(200)).to.equal(true);
        expect(res.send.firstCall.args[0]).to.deep.equal({ xpAwarded: 0 });
    });

    it('rejects an unauthenticated request without counting it', async () => {
        const claimStub = sinon.stub(redisClient, 'tryClaimAppOpenXp').resolves(true);
        const res = mockResponse();

        await recordAppOpen({ headers: { ...habitsHeaders, 'x-userid': undefined } } as any, res, () => null);

        expect(claimStub.called).to.equal(false);
        expect(res.status.calledWith(401)).to.equal(true);
    });
});

describe('createUserHelper — registration XP', () => {
    let incrementStub: sinon.SinonStub;

    beforeEach(() => {
        sinon.stub(Store.verificationCodes, 'createCode').resolves({} as any);
        sinon.stub(Store.users, 'createUser').resolves([{ id: 'new-user', email: 'new.user@example.com' }] as any);
        sinon.stub(Store.users, 'updateUser').resolves([] as any);
        sinon.stub(awsSES, 'sendEmail').resolves({} as any);
        incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);
    });

    afterEach(() => {
        sinon.restore();
    });

    // No x-userid: registration is a pre-auth request, so the award must target the new account.
    const registrationHeaders = {
        'x-platform': 'mobile',
        'x-brand-variation': BrandVariations.HABITS,
        'x-localecode': 'en-us',
    };

    it('pays the new account its registration XP on this week\'s board', async () => {
        await createUserHelper(registrationHeaders as any, {
            email: 'new.user@example.com',
            password: 'strinG123!',
        });

        expect(incrementStub.calledOnceWith(
            BrandVariations.HABITS,
            'new-user',
            getLeaderboardPeriodStart(),
            LeaderboardXpValues.registration,
        )).to.equal(true);
    });

    it('pays nothing for a placeholder account created by someone else\'s invite', async () => {
        await createUserHelper(registrationHeaders as any, {
            email: 'new.user@example.com',
        }, {
            userByInviteDetails: {
                fromName: 'Inviter',
                fromEmail: 'inviter@example.com',
                toEmail: 'new.user@example.com',
            },
        });

        expect(incrementStub.called).to.equal(false);
    });
});
