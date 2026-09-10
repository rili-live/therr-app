/**
 * Re-seeding a user's stream when they share where they are.
 *
 * This is what makes "share your location, see posts about your city" happen in the session
 * the user is already in. Login seeds the stream before any location exists, so for a new
 * account it is the only chance to get local content in front of them without waiting for
 * the next sign-in.
 *
 * Two things constrain the trigger, and both are asserted here:
 *  - `main.userLocations` rows are keyed on coordinates rounded to ~111m, so a client
 *    reporting movement writes rows continuously. The run is therefore gated on the same
 *    per-user window as the notifications poll rather than firing on every ping.
 *  - Reactions are stamped with `x-userid`, so a run for the path parameter alone would let
 *    a caller seed somebody else's stream.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { createUserLocations } from '../../src/handlers/userLocations';
import Store from '../../src/store';
import TherrEventEmitter from '../../src/api/TherrEventEmitter';
import { DISTRIBUTOR_MIN_SECONDS_BETWEEN_RUNS } from '../../src/utilities/distributorGate';

/** Lets the setImmediate the distributor is deferred behind actually run. */
const flush = () => new Promise((resolve) => { setImmediate(resolve); });

describe('createUserLocations — thought distributor trigger', () => {
    let distributorStub: sinon.SinonStub;
    let res: any;

    const buildReq = (overrides: any = {}) => ({
        headers: {
            'x-userid': 'user-1',
            'x-brand-variation': 'therr',
            ...(overrides.headers || {}),
        },
        params: { userId: 'user-1', ...(overrides.params || {}) },
        body: { latitude: 41.8781, longitude: -87.6298 },
    });

    beforeEach(() => {
        res = {
            status: sinon.stub().returnsThis(),
            send: sinon.stub().returnsThis(),
        };

        distributorStub = sinon.stub(TherrEventEmitter, 'runThoughtDistributorAlgorithm').resolves({});
        sinon.stub(Store.userLocations, 'create').resolves([{ id: 'location-1' }] as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('seeds the stream for the user who reported the location', async () => {
        await createUserLocations(buildReq(), res);
        await flush();

        expect(distributorStub.calledOnce).to.equal(true);
        expect(distributorStub.args[0][1]).to.deep.equal(['user-1']);
    });

    it('gates the run on the shared per-user window rather than firing on every ping', async () => {
        await createUserLocations(buildReq(), res);
        await flush();

        // Background location reporting would otherwise trigger a run every few steps.
        expect(distributorStub.args[0][4]).to.equal(DISTRIBUTOR_MIN_SECONDS_BETWEEN_RUNS);
        expect(DISTRIBUTOR_MIN_SECONDS_BETWEEN_RUNS).to.be.greaterThan(0);
    });

    it('does not seed a stream the caller was not authenticated as', async () => {
        await createUserLocations(buildReq({ params: { userId: 'someone-else' } }), res);
        await flush();

        expect(distributorStub.called).to.equal(false);
    });

    it('does not seed when there is no authenticated user on the request', async () => {
        await createUserLocations(buildReq({ headers: { 'x-userid': '' } }), res);
        await flush();

        expect(distributorStub.called).to.equal(false);
    });

    it('still answers the location write, which is what the client actually asked for', async () => {
        await createUserLocations(buildReq(), res);

        expect(res.status.calledWith(201)).to.equal(true);
        expect(res.send.args[0][0]).to.deep.equal({ userLocations: [{ id: 'location-1' }] });
    });
});
