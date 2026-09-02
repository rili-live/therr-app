import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { getCheckinProofs } from '../../src/handlers/habitCheckins';

/**
 * `GET /habits/checkins/:id/proofs` — the handler around the pure helpers in
 * checkinProofs.test.ts.
 *
 * The rule this file exists for is the store rejection. `id` is a uuid column,
 * so a malformed path segment does not return no rows — Postgres throws. This
 * service registers no async-handler wrapper and runs Express 4, which does not
 * catch a rejected handler promise, so an unguarded `await` answers nothing at
 * all: the request hangs to its timeout and the only trace is an unhandled
 * rejection. Every sibling handler routes failures through `handleHttpError`,
 * and a test is the only thing that notices when a new one does not.
 */

const OWNER = 'aaaaaaaa-0000-4000-8000-00000000000a';
const OTHER = 'bbbbbbbb-0000-4000-8000-00000000000b';
const CHECKIN_ID = 'cccccccc-0000-4000-8000-00000000000c';

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

const callHandler = async (userId: string, id = CHECKIN_ID) => {
    const { captured, res } = buildRes();
    await getCheckinProofs({
        headers: { 'x-userid': userId, 'x-localecode': 'en-us', 'x-brand-variation': 'habits' },
        params: { id },
    } as any, res, (() => undefined) as any);
    return captured;
};

describe('getCheckinProofs', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('answers with an error instead of hanging when the check-in lookup rejects', async () => {
        // A non-uuid `:id` reaches Postgres as `invalid input syntax for type
        // uuid` — the realistic trigger, and one any client can produce.
        sinon.stub(Store.habitCheckins, 'getById').rejects(new Error('invalid input syntax for type uuid'));

        const captured = await callHandler(OWNER, 'not-a-uuid');

        expect(captured.statusCode, 'handler returned no response at all').to.be.a('number');
        expect(captured.statusCode).to.be.greaterThanOrEqual(400);
    });

    it('returns an empty set without querying when the check-in carries no proof', async () => {
        sinon.stub(Store.habitCheckins, 'getById').resolves({ id: CHECKIN_ID, userId: OWNER, hasProof: false } as any);
        const getByCheckinId = sinon.stub(Store.proofs, 'getByCheckinId').resolves([] as any);

        const captured = await callHandler(OWNER);

        expect(captured.statusCode).to.equal(200);
        expect(captured.body).to.deep.equal({ proofs: [] });
        expect(getByCheckinId.called, 'skipped the query for a check-in with no proof').to.equal(false);
    });

    it('serializes the proofs for the owner', async () => {
        sinon.stub(Store.habitCheckins, 'getById').resolves({ id: CHECKIN_ID, userId: OWNER, hasProof: true } as any);
        sinon.stub(Store.proofs, 'getByCheckinId').resolves([{
            id: 'proof-1',
            checkinId: CHECKIN_ID,
            mediaType: 'image',
            mediaPath: 'user/content/proof.jpeg',
            createdAt: new Date('2026-08-20T10:00:00.000Z'),
        }] as any);

        const captured = await callHandler(OWNER);

        expect(captured.statusCode).to.equal(200);
        expect(captured.body.proofs).to.have.length(1);
        expect(captured.body.proofs[0].path).to.equal('user/content/proof.jpeg');
    });

    it('refuses a requester who does not own the check-in', async () => {
        sinon.stub(Store.habitCheckins, 'getById').resolves({ id: CHECKIN_ID, userId: OWNER, hasProof: true } as any);
        const getByCheckinId = sinon.stub(Store.proofs, 'getByCheckinId').resolves([] as any);

        const captured = await callHandler(OTHER);

        // A proof path IS the access control for the image behind it — private
        // media resolves to a deterministic URL, not a signed one.
        expect(captured.statusCode).to.equal(403);
        expect(getByCheckinId.called).to.equal(false);
    });

    it('reports a missing check-in as 404 rather than an empty proof set', async () => {
        sinon.stub(Store.habitCheckins, 'getById').resolves(undefined as any);

        const captured = await callHandler(OWNER);

        expect(captured.statusCode).to.equal(404);
    });
});
