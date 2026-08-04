/* eslint-disable quotes */
import { expect } from 'chai';
import sinon from 'sinon';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import { findThoughts } from '../../src/handlers/thoughts';
import Store from '../../src/store';

const VIEWER_USER_ID = 'viewer-user-id';
const AUTHOR_USER_ID = 'author-user-id';

/**
 * `isFriend` is not cosmetic: in `ThoughtsStore.find` it drops the `isPublic = true`
 * predicate entirely, so a true value hands the caller the author's non-public thoughts.
 * It therefore has to mean a *live* connection — the same thing the connections list means.
 */
describe('handlers/thoughts findThoughts', () => {
    let findStub: sinon.SinonStub;

    const runWithConnection = async (connectionRow: any) => {
        sinon.stub(Store.userConnections, 'getUserConnections').resolves(connectionRow ? [connectionRow] : []);

        const res: any = {};
        res.status = sinon.stub().returns(res);
        res.send = sinon.stub().returns(res);

        await findThoughts({
            headers: { 'x-userid': VIEWER_USER_ID },
            body: { authorId: AUTHOR_USER_ID, thoughtIds: [] },
        } as any, res, (() => {}) as any);

        // Store.thoughts.find(brand, thoughtIds, filters, options) — `isFriend` is an option.
        return findStub.firstCall.args[3];
    };

    beforeEach(() => {
        findStub = sinon.stub(Store.thoughts, 'find').resolves({
            thoughts: [], users: {}, isLastPage: true,
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    it('treats a completed, unbroken connection as a friend', async () => {
        const options = await runWithConnection({
            requestingUserId: VIEWER_USER_ID,
            acceptingUserId: AUTHOR_USER_ID,
            requestStatus: UserConnectionTypes.COMPLETE,
            isConnectionBroken: false,
        });

        expect(options.isFriend).to.equal(true);
    });

    it('does not treat a removed connection as a friend', async () => {
        // The leak: an unconnect leaves `requestStatus` at 'complete' and only flips
        // `isConnectionBroken`, so a status-only check kept a former connection reading as a
        // friend — and `isFriend` is what removes the isPublic filter on the author's thoughts.
        const options = await runWithConnection({
            requestingUserId: VIEWER_USER_ID,
            acceptingUserId: AUTHOR_USER_ID,
            requestStatus: UserConnectionTypes.COMPLETE,
            isConnectionBroken: true,
        });

        expect(options.isFriend).to.equal(false);
    });

    it('does not treat a pending request as a friend', async () => {
        const options = await runWithConnection({
            requestingUserId: VIEWER_USER_ID,
            acceptingUserId: AUTHOR_USER_ID,
            requestStatus: UserConnectionTypes.PENDING,
            isConnectionBroken: false,
        });

        expect(options.isFriend).to.equal(false);
    });

    it('does not treat a stranger as a friend', async () => {
        const options = await runWithConnection(null);

        expect(options.isFriend).to.equal(false);
    });
});
