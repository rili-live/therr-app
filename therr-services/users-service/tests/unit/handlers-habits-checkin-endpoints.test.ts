import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { getPactCheckins, skipCheckin, updateCheckin } from '../../src/handlers/habitCheckins';

/**
 * The read/update check-in endpoints around createCheckin.
 *
 *   - `GET /habits/checkins/pact/:pactId` authorized on the 1:1 columns only. A group pact has
 *     no partnerUserId, so every group member but the creator was refused their own pact's
 *     check-ins — the gap createCheckin already closed by consulting pact_members.
 *   - `id` / `pactId` are uuid columns, so a malformed path segment makes Postgres throw. This
 *     service runs Express 4 with no async wrapper, so an unguarded `await` answers nothing:
 *     the request hangs to its timeout (see handlers-habits-checkin-proofs.test.ts).
 */

const CREATOR = 'aaaaaaaa-0000-4000-8000-00000000000a';
const GROUP_MEMBER = 'bbbbbbbb-0000-4000-8000-00000000000b';
const STRANGER = 'cccccccc-0000-4000-8000-00000000000c';
const PACT_ID = 'dddddddd-0000-4000-8000-00000000000d';

const buildRes = () => {
    const captured: { statusCode?: number; body?: any } = {};
    return {
        captured,
        res: {
            status: (statusCode: number) => {
                captured.statusCode = statusCode;
                return { send: (payload: any) => { captured.body = payload; return payload; } };
            },
        } as any,
    };
};

const call = async (handler: any, userId: string, params: Record<string, string>, body: any = {}) => {
    const { captured, res } = buildRes();
    await handler({
        headers: { 'x-userid': userId, 'x-localecode': 'en-us', 'x-brand-variation': 'habits' },
        params,
        query: {},
        body,
    } as any, res, (() => undefined) as any);
    return captured;
};

describe('check-in endpoints — pact access and malformed ids', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('getPactCheckins', () => {
        let getByPactId: sinon.SinonStub;
        let getByPactAndUser: sinon.SinonStub;

        beforeEach(() => {
            sinon.stub(Store.pacts, 'getById').resolves({ id: PACT_ID, creatorUserId: CREATOR, partnerUserId: null } as any);
            getByPactAndUser = sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(undefined);
            getByPactId = sinon.stub(Store.habitCheckins, 'getByPactId').resolves([{ id: 'checkin-1' }] as any);
        });

        it('lets an active group member read their pact\'s check-ins', async () => {
            getByPactAndUser.resolves({ userId: GROUP_MEMBER, status: 'active' } as any);

            const captured = await call(getPactCheckins, GROUP_MEMBER, { pactId: PACT_ID });

            expect(captured.statusCode).to.equal(200);
            expect(getByPactId.calledOnce).to.equal(true);
        });

        it('still refuses a member who has left', async () => {
            getByPactAndUser.resolves({ userId: STRANGER, status: 'left' } as any);

            const captured = await call(getPactCheckins, STRANGER, { pactId: PACT_ID });

            expect(captured.statusCode).to.equal(403);
            expect(getByPactId.called).to.equal(false);
        });

        it('lets the creator in without a membership lookup', async () => {
            const captured = await call(getPactCheckins, CREATOR, { pactId: PACT_ID });

            expect(captured.statusCode).to.equal(200);
            expect(getByPactAndUser.called).to.equal(false);
        });
    });

    describe('malformed ids answer instead of hanging', () => {
        const uuidError = () => new Error('invalid input syntax for type uuid');

        it('getPactCheckins', async () => {
            sinon.stub(Store.pacts, 'getById').rejects(uuidError());

            const captured = await call(getPactCheckins, CREATOR, { pactId: 'not-a-uuid' });

            expect(captured.statusCode, 'handler returned no response at all').to.be.a('number');
            expect(captured.statusCode).to.be.greaterThanOrEqual(400);
        });

        it('updateCheckin', async () => {
            sinon.stub(Store.habitCheckins, 'getById').rejects(uuidError());

            const captured = await call(updateCheckin, CREATOR, { id: 'not-a-uuid' }, { notes: 'x' });

            expect(captured.statusCode, 'handler returned no response at all').to.be.a('number');
            expect(captured.statusCode).to.be.greaterThanOrEqual(400);
        });

        it('skipCheckin', async () => {
            sinon.stub(Store.habitCheckins, 'getById').rejects(uuidError());

            const captured = await call(skipCheckin, CREATOR, { id: 'not-a-uuid' });

            expect(captured.statusCode, 'handler returned no response at all').to.be.a('number');
            expect(captured.statusCode).to.be.greaterThanOrEqual(400);
        });
    });
});
