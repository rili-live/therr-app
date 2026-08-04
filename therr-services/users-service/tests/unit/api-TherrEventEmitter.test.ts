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

    const userWith = (settingsContentAlgorithm: string | undefined, interestKeys: string[] = []) => ({
        id: 'user-1',
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

    // The login path batches up to 10 recently-active users into a single run. Resolving one
    // profile for that batch would let whichever user sorted first rank everybody's stream.
    it('falls back to the default profile for a mixed multi-user batch', async () => {
        stubContextUsers([
            userWith(ContentAlgorithms.FOCUS, ['interests.hiking']),
            userWith(ContentAlgorithms.PULSE, ['interests.coffee']),
        ]);

        await TherrEventEmitter.runThoughtDistributorAlgorithm(HEADERS, ['user-1', 'user-2'], 'createdAt', 10);

        getRecentThoughtsStub.args.forEach((args) => {
            expect(args[4].key).to.equal(ContentAlgorithms.PULSE);
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
