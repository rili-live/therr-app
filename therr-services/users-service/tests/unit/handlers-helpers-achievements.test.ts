/* eslint-disable quotes, max-len */
/**
 * Regression tests for niche-brand achievement isolation.
 *
 * Setup: every current achievement class (`socialite`, `explorer`, `influencer`,
 * `thinker`, `communityLeader`, etc.) is content-coupled to Therr. A niche app
 * (HABITS, TEEM) must not write Therr-themed achievements stamped with its
 * brandVariation, even though the SQL filter would technically return them as
 * "same-brand" rows.
 *
 * The brand-row SQL filter (BrandScopedStore) prevents cross-brand reads.
 * `createOrUpdateAchievement` adds the second layer: skip Therr-themed classes
 * entirely when the request comes from a niche brand, so neither the
 * userAchievement row nor the resulting ACHIEVEMENT_COMPLETED notification gets
 * written under the niche brand's tag.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { createOrUpdateAchievement } from '../../src/handlers/helpers/achievements';

describe('createOrUpdateAchievement — brand gating', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('no-ops on a niche brand (HABITS) and never touches the achievements store', async () => {
        const getStub = sinon.stub(Store.userAchievements, 'get');
        const updateAndCreateStub = sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive');

        const result = await createOrUpdateAchievement({
            authorization: 'Bearer test',
            'x-userid': 'user-1',
            'x-brand-variation': BrandVariations.HABITS,
            'x-platform': 'mobile',
            'x-localecode': 'en-us',
        }, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 1,
        });

        expect(getStub.called, 'Store.userAchievements.get must not be called for HABITS').to.equal(false);
        expect(updateAndCreateStub.called, 'updateAndCreateConsecutive must not be called for HABITS').to.equal(false);
        expect(result).to.deep.equal({ created: [], updated: [], action: 'incomplete' });
    });

    it('no-ops on a niche brand (TEEM) for every Therr-themed class', async () => {
        const getStub = sinon.stub(Store.userAchievements, 'get');
        const updateAndCreateStub = sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive');

        const therrClasses = ['socialite', 'explorer', 'influencer', 'thinker', 'communityLeader'];
        for (const achievementClass of therrClasses) {
            // eslint-disable-next-line no-await-in-loop
            const result = await createOrUpdateAchievement({
                authorization: 'Bearer test',
                'x-userid': 'user-1',
                'x-brand-variation': BrandVariations.TEEM,
                'x-platform': 'mobile',
                'x-localecode': 'en-us',
            }, {
                achievementClass,
                achievementTier: '1_1',
                progressCount: 1,
            });
            expect(result.created).to.have.lengthOf(0);
            expect(result.updated).to.have.lengthOf(0);
        }

        expect(getStub.called).to.equal(false);
        expect(updateAndCreateStub.called).to.equal(false);
    });

    it('proceeds normally on the THERR brand', async () => {
        const getStub = sinon.stub(Store.userAchievements, 'get').resolves([]);
        const updateAndCreateStub = sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            created: [],
            updated: [],
            action: 'incomplete',
        });

        await createOrUpdateAchievement({
            authorization: 'Bearer test',
            'x-userid': 'user-1',
            'x-brand-variation': BrandVariations.THERR,
            'x-platform': 'mobile',
            'x-localecode': 'en-us',
        }, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 1,
        });

        expect(getStub.calledOnce, 'Store.userAchievements.get should run for THERR').to.equal(true);
        expect(updateAndCreateStub.calledOnce, 'updateAndCreateConsecutive should run for THERR').to.equal(true);
        // First arg is the brand — must thread through unchanged.
        expect(getStub.firstCall.args[0]).to.equal(BrandVariations.THERR);
        expect(updateAndCreateStub.firstCall.args[0]).to.equal(BrandVariations.THERR);
    });

    it('rejects an unknown achievement class regardless of brand', async () => {
        const getStub = sinon.stub(Store.userAchievements, 'get');

        try {
            await createOrUpdateAchievement({
                authorization: 'Bearer test',
                'x-userid': 'user-1',
                'x-brand-variation': BrandVariations.THERR,
                'x-platform': 'mobile',
                'x-localecode': 'en-us',
            }, {
                achievementClass: 'madeUpClass',
                achievementTier: '1_1',
                progressCount: 1,
            });
            expect.fail('expected createOrUpdateAchievement to reject');
        } catch (err: any) {
            expect(err.message).to.equal('invalid-achievement-class');
        }
        expect(getStub.called).to.equal(false);
    });

    it('defaults to a non-explicit brand context as THERR (legacy token path)', async () => {
        // Legacy clients without x-brand-variation are treated as THERR by
        // getBrandContext — see therr-js-utilities/http/get-brand-context. The
        // achievement helper must respect that and proceed as THERR, not skip.
        const getStub = sinon.stub(Store.userAchievements, 'get').resolves([]);
        const updateAndCreateStub = sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            created: [],
            updated: [],
            action: 'incomplete',
        });

        await createOrUpdateAchievement({
            authorization: 'Bearer test',
            'x-userid': 'user-1',
            'x-platform': 'mobile',
            'x-localecode': 'en-us',
        } as any, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 1,
        });

        expect(getStub.calledOnce).to.equal(true);
        expect(getStub.firstCall.args[0]).to.equal(BrandVariations.THERR);
        expect(updateAndCreateStub.calledOnce).to.equal(true);
    });
});
