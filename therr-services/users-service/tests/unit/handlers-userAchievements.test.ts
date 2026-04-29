/* eslint-disable quotes, max-len */
/**
 * Regression tests for the public-read user achievements handler.
 *
 * Privacy contract:
 *   - The endpoint is anonymous-readable (no JWT required at the gateway).
 *   - It must respect `settingsIsProfilePublic` on the target user; a private
 *     or soft-deleted user yields 404 (no existence disclosure).
 *   - It must surface ONLY completed rows.
 *   - It must strip private fields (unclaimedRewardPts, brandVariation,
 *     createdAt/updatedAt) so a non-self viewer never sees in-progress
 *     progress counts or pending point balances.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { getPublicUserAchievements } from '../../src/handlers/userAchievements';

const buildResponse = () => {
    const res: any = {
        statusCode: 200,
        body: undefined,
    };
    res.status = sinon.stub().callsFake((code: number) => {
        res.statusCode = code;
        return res;
    });
    res.send = sinon.stub().callsFake((body: any) => {
        res.body = body;
        return res;
    });
    return res;
};

const buildRequest = (overrides: any = {}) => ({
    headers: {
        'x-brand-variation': BrandVariations.HABITS,
        'x-userid': 'viewer-user-id',
        'x-localecode': 'en-us',
        'x-platform': 'mobile',
        ...overrides.headers,
    },
    params: {
        userId: 'target-user-id',
        ...overrides.params,
    },
});

const stubPublicTargetUser = () => sinon.stub(Store.users, 'getUserById').resolves([{
    id: 'target-user-id',
    settingsIsProfilePublic: true,
    settingsIsAccountSoftDeleted: false,
}]);

describe('getPublicUserAchievements handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('calls Store.userAchievements.getCompleted with the target userId and the request brand', async () => {
        stubPublicTargetUser();
        const getCompletedStub = sinon.stub(Store.userAchievements, 'getCompleted').resolves([]);

        const req = buildRequest();
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(getCompletedStub.calledOnce).to.equal(true);
        const [brandArg, conditionsArg] = getCompletedStub.firstCall.args;
        expect(brandArg).to.equal(BrandVariations.HABITS);
        expect(conditionsArg).to.deep.equal({ userId: 'target-user-id' });
    });

    it('uses the brand from x-brand-variation, not the viewer', async () => {
        stubPublicTargetUser();
        const getCompletedStub = sinon.stub(Store.userAchievements, 'getCompleted').resolves([]);

        const req = buildRequest({ headers: { 'x-brand-variation': BrandVariations.THERR } });
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(getCompletedStub.firstCall.args[0]).to.equal(BrandVariations.THERR);
    });

    it('strips private fields (unclaimedRewardPts, brandVariation, createdAt, updatedAt) from each row', async () => {
        stubPublicTargetUser();
        const completedRow = {
            id: 'ach-1',
            userId: 'target-user-id',
            achievementId: 'explorer_1_1',
            achievementClass: 'explorer',
            achievementTier: '1_1',
            progressCount: 5,
            completedAt: new Date('2026-04-20T00:00:00Z'),
            // Private — must NOT appear in the public response.
            unclaimedRewardPts: 100,
            brandVariation: 'habits',
            createdAt: new Date('2026-04-19T00:00:00Z'),
            updatedAt: new Date('2026-04-20T00:00:00Z'),
        };
        sinon.stub(Store.userAchievements, 'getCompleted').resolves([completedRow]);

        const req = buildRequest();
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.have.lengthOf(1);
        const sanitized = res.body[0];

        expect(Object.keys(sanitized).sort()).to.deep.equal([
            'achievementClass',
            'achievementId',
            'achievementTier',
            'completedAt',
            'id',
            'progressCount',
            'userId',
        ]);
        expect(sanitized).to.not.have.property('unclaimedRewardPts');
        expect(sanitized).to.not.have.property('brandVariation');
        expect(sanitized).to.not.have.property('createdAt');
        expect(sanitized).to.not.have.property('updatedAt');
    });

    it('returns an empty array when the target user has no completed achievements', async () => {
        stubPublicTargetUser();
        sinon.stub(Store.userAchievements, 'getCompleted').resolves([]);

        const req = buildRequest();
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.deep.equal([]);
    });

    it('returns 404 when :userId param is missing', async () => {
        const getUserStub = sinon.stub(Store.users, 'getUserById');
        const getCompletedStub = sinon.stub(Store.userAchievements, 'getCompleted');

        const req = buildRequest({ params: { userId: undefined } });
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(getUserStub.called).to.equal(false);
        expect(getCompletedStub.called).to.equal(false);
        expect(res.statusCode).to.equal(404);
    });

    it('returns 404 without leaking achievements when the target user has a private profile', async () => {
        sinon.stub(Store.users, 'getUserById').resolves([{
            id: 'target-user-id',
            settingsIsProfilePublic: false,
            settingsIsAccountSoftDeleted: false,
        }]);
        const getCompletedStub = sinon.stub(Store.userAchievements, 'getCompleted');

        const req = buildRequest();
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(res.statusCode).to.equal(404);
        // Critical: never query achievements when the profile is private — even
        // an unused stubbed call here would represent a privacy regression.
        expect(getCompletedStub.called).to.equal(false);
    });

    it('returns 404 when the target user is soft-deleted', async () => {
        sinon.stub(Store.users, 'getUserById').resolves([{
            id: 'target-user-id',
            settingsIsProfilePublic: true,
            settingsIsAccountSoftDeleted: true,
        }]);
        const getCompletedStub = sinon.stub(Store.userAchievements, 'getCompleted');

        const req = buildRequest();
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(res.statusCode).to.equal(404);
        expect(getCompletedStub.called).to.equal(false);
    });

    it('returns 404 when the target user does not exist', async () => {
        sinon.stub(Store.users, 'getUserById').resolves([]);
        const getCompletedStub = sinon.stub(Store.userAchievements, 'getCompleted');

        const req = buildRequest();
        const res = buildResponse();

        await getPublicUserAchievements(req as any, res as any, (() => undefined) as any);

        expect(res.statusCode).to.equal(404);
        expect(getCompletedStub.called).to.equal(false);
    });
});
