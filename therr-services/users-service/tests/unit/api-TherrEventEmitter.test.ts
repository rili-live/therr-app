/* eslint-disable quotes */
/**
 * The thought distributor's algorithm-awareness.
 *
 * These assert on the arguments handed to `getRecentThoughts`, because that is where every
 * profile decision actually manifests — which candidate queries run, and with which profile.
 * Returning empty candidate sets from both stubs makes the distributor return early without
 * reaching `createReactions`, so no cross-service call is involved.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { ContentAlgorithms } from 'therr-js-utilities/content-ranking';
import TherrEventEmitter from '../../src/api/TherrEventEmitter';
import Store from '../../src/store';

const HEADERS: any = {
    'x-userid': 'user-1',
    'x-brand-variation': 'therr',
};

describe('TherrEventEmitter.runThoughtDistributorAlgorithm — content algorithms', () => {
    let findUsersStub: sinon.SinonStub;
    let getRecentThoughtsStub: sinon.SinonStub;

    const stubContextUsers = (users: any[]) => {
        findUsersStub.callsFake(() => Promise.resolve(users));
    };

    // Defaults to the id in HEADERS, since most cases are a run for the reaction owner.
    const userWith = (settingsContentAlgorithm: string | undefined, interestKeys: string[] = [], id = 'user-1') => ({
        id,
        settingsContentAlgorithm,
        userInterests: interestKeys.map((displayNameKey) => ({ displayNameKey })),
    });

    beforeEach(() => {
        findUsersStub = sinon.stub(Store.users, 'findUsersWithInterests');
        // Empty results end the run before createReactions, which is what keeps this a pure
        // unit test of the selection logic.
        getRecentThoughtsStub = sinon.stub(Store.thoughts, 'getRecentThoughts').callsFake(() => Promise.resolve([]));
    });

    afterEach(() => {
        sinon.restore();
    });

    it('selects the user\'s own profile when the run is for a single user', async () => {
        stubContextUsers([userWith(ContentAlgorithms.FOCUS, ['interests.hiking'])]);

        await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1']);

        const profile = getRecentThoughtsStub.args[0][4];
        expect(profile.key).to.equal(ContentAlgorithms.FOCUS);
    });

    it('asks for the settings column, or there would be no algorithm to resolve', async () => {
        stubContextUsers([userWith(ContentAlgorithms.PULSE)]);

        await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1']);

        expect(findUsersStub.args[0][1]).to.include('settingsContentAlgorithm');
    });

    it('defaults to PULSE for a user who has never picked one', async () => {
        stubContextUsers([userWith(undefined, ['interests.hiking'])]);

        await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1']);

        expect(getRecentThoughtsStub.args[0][4].key).to.equal(ContentAlgorithms.PULSE);
    });

    /**
     * Which user's algorithm ranks a run.
     *
     * The reaction rows this run writes are stamped with `x-userid`, so that user owns the
     * stream being scored and their profile is the only one entitled to score it. No caller
     * batches users today, but the moment one does, resolving off the context list would let
     * a batch stamp one user's rows with another user's `algorithmKey`.
     */
    describe('profile ownership', () => {
        it('uses the reaction owner\'s profile even when the batch contains other users', async () => {
            stubContextUsers([
                userWith(ContentAlgorithms.PULSE, ['interests.coffee'], 'user-2'),
                userWith(ContentAlgorithms.FOCUS, ['interests.hiking'], 'user-1'),
            ]);

            await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1', 'user-2'], 'createdAt', 10);

            // FOCUS is user-1's, and user-1 is the x-userid the rows will be written under —
            // note it is not the first entry, so this cannot pass by list order alone.
            getRecentThoughtsStub.args.forEach((args) => {
                expect(args[4].key).to.equal(ContentAlgorithms.FOCUS);
            });
        });

        it('takes the default when the batch does not contain the reaction owner at all', async () => {
            stubContextUsers([
                userWith(ContentAlgorithms.FOCUS, ['interests.hiking'], 'user-2'),
                userWith(ContentAlgorithms.FOCUS, ['interests.coffee'], 'user-3'),
            ]);

            await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-2', 'user-3'], 'createdAt', 10);

            getRecentThoughtsStub.args.forEach((args) => {
                expect(args[4].key).to.equal(ContentAlgorithms.PULSE);
            });
        });

        // Internal triggers can seed a stream without an authenticated header. A one-user run
        // still names its owner unambiguously, so it keeps resolving that user's profile.
        it('falls back to a single context user when no x-userid is present', async () => {
            stubContextUsers([userWith(ContentAlgorithms.FOCUS, ['interests.hiking'])]);

            await TherrEventEmitter.runThoughtDistributorAlgorithm(
                { 'x-brand-variation': 'therr' } as any,
                ['user-1'],
                'createdAt',
                10,
            );

            expect(getRecentThoughtsStub.args[0][4].key).to.equal(ContentAlgorithms.FOCUS);
        });

        it('takes the default for an unattributable batch — no header user and no single owner', async () => {
            stubContextUsers([
                userWith(ContentAlgorithms.FOCUS, ['interests.hiking'], 'user-1'),
                userWith(ContentAlgorithms.FOCUS, ['interests.coffee'], 'user-2'),
            ]);

            await TherrEventEmitter.runThoughtDistributorAlgorithm(
                { 'x-brand-variation': 'therr' } as any,
                ['user-1', 'user-2'],
                'createdAt',
                10,
            );

            getRecentThoughtsStub.args.forEach((args) => {
                expect(args[4].key).to.equal(ContentAlgorithms.PULSE);
            });
        });
    });

    describe('FOCUS hard interest filter', () => {
        it('runs only the interest-matched query when the user has interests', async () => {
            stubContextUsers([userWith(ContentAlgorithms.FOCUS, ['interests.hiking'])]);

            await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1'], 'createdAt', 10);

            expect(getRecentThoughtsStub.callCount).to.equal(1);
            // Second positional arg is the interest key list.
            expect(getRecentThoughtsStub.args[0][2]).to.deep.equal(['interests.hiking']);
        });

        // ALGORITHM_AUDIT E2: SSO and onboarding-skip users have no userInterests rows at all.
        // Honoring the hard filter literally would give them a permanently empty stream, which
        // reads as a broken app rather than a strict algorithm.
        it('still fills from general candidates when the user has NO interests', async () => {
            stubContextUsers([userWith(ContentAlgorithms.FOCUS, [])]);

            await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1'], 'createdAt', 10);

            expect(getRecentThoughtsStub.callCount).to.equal(1);
            // ...and that one call is the general query — no interest keys.
            expect(getRecentThoughtsStub.args[0][2]).to.deep.equal([]);
            expect(getRecentThoughtsStub.args[0][4].key).to.equal(ContentAlgorithms.FOCUS);
        });

        it('leaves PULSE running both queries, exactly as before profiles existed', async () => {
            stubContextUsers([userWith(ContentAlgorithms.PULSE, ['interests.hiking'])]);

            await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1'], 'createdAt', 10);

            expect(getRecentThoughtsStub.callCount).to.equal(2);
            expect(getRecentThoughtsStub.args[0][2]).to.deep.equal(['interests.hiking']);
            expect(getRecentThoughtsStub.args[1][2]).to.deep.equal([]);
        });
    });

    it('takes the activation batch size from the profile', async () => {
        stubContextUsers([userWith(ContentAlgorithms.PULSE, ['interests.hiking'])]);

        await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1'], 'createdAt', 10);

        const profile = getRecentThoughtsStub.args[0][4];
        const requestedLimit = getRecentThoughtsStub.args[0][1];
        expect(requestedLimit).to.be.at.least(profile.minActivationBatch);
        expect(requestedLimit).to.be.at.most(profile.maxActivationBatch);
    });

    it('still requests a single fallback candidate on the notifications-poll path', async () => {
        stubContextUsers([userWith(ContentAlgorithms.PULSE, ['interests.hiking'])]);

        // recentUsersCount = 0 is the poll path: general candidates are not added to the
        // batch, so ranking a full page just to discard all but one would be wasted work.
        await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1'], 'updatedAt', 0);

        expect(getRecentThoughtsStub.args[1][1]).to.equal(1);
    });
});
