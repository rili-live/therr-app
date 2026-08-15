import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { getJournalFeed } from '../../src/handlers/journal';

/**
 * The journal feed merge.
 *
 * Four of the five sources are unioned in SQL; achievements come from the
 * brand-scoped `main.userAchievements` and are merged in the handler. The
 * risky part is that merge — a mis-ordered or mis-cursored page silently
 * drops entries the user wrote, which is the one kind of bug a journal must
 * not have.
 */
const makeRes = () => {
    const res: any = {
        statusCode: undefined,
        body: undefined,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        send(payload: any) {
            res.body = payload;
            return res;
        },
    };
    return res;
};

const makeReq = (query: any = {}) => ({
    headers: {
        'x-userid': 'user-1',
        'x-localecode': 'en-us',
        'x-brand-variation': BrandVariations.HABITS,
    },
    query,
    params: {},
    body: {},
});

const habitsRow = (id: string, occurredAt: string, type = 'note') => ({
    id,
    type,
    occurredAt: new Date(occurredAt),
    entryDate: occurredAt,
    body: `body-${id}`,
    habitGoalId: null,
    goalName: null,
    goalEmoji: null,
    meta: null,
});

describe('Journal feed', () => {
    let getFeedStub: sinon.SinonStub;
    let getCompletedStub: sinon.SinonStub;

    beforeEach(() => {
        getFeedStub = sinon.stub(Store.journalEntries, 'getFeed').resolves([]);
        getCompletedStub = sinon.stub(Store.userAchievements, 'getCompleted').resolves([]);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('reads achievements through the brand-scoped store with the request brand', async () => {
        // Unscoped, this would spill a user's Therr achievements into their
        // Friends with Habits journal.
        const res = makeRes();
        await getJournalFeed(makeReq() as any, res, (() => {}) as any);

        expect(getCompletedStub.firstCall.args[0]).to.equal(BrandVariations.HABITS);
        expect(getCompletedStub.firstCall.args[1]).to.deep.equal({ userId: 'user-1' });
    });

    it('interleaves achievements with habits rows, newest first', async () => {
        getFeedStub.resolves([
            habitsRow('n1', '2026-08-14T10:00:00.000Z'),
            habitsRow('n2', '2026-08-12T10:00:00.000Z'),
        ]);
        getCompletedStub.resolves([
            { id: 'a1', completedAt: '2026-08-13T10:00:00.000Z', achievementClass: 'consistency' },
        ]);

        const res = makeRes();
        await getJournalFeed(makeReq() as any, res, (() => {}) as any);

        expect(res.body.items.map((i: any) => i.id)).to.deep.equal(['n1', 'a1', 'n2']);
        expect(res.body.items[1].type).to.equal('achievement');
    });

    it('normalizes entryDate to a bare calendar day', async () => {
        getFeedStub.resolves([habitsRow('n1', '2026-08-14T23:30:00.000Z')]);

        const res = makeRes();
        await getJournalFeed(makeReq() as any, res, (() => {}) as any);

        expect(res.body.items[0].entryDate).to.equal('2026-08-14');
    });

    it('keeps the stored day when the driver hands back a local-midnight Date', async () => {
        // node-pg parses a `date` column into a Date at LOCAL midnight. Going
        // through toISOString would roll it back a day in any positive-offset
        // timezone, filing a check-in under the day before it happened.
        const row: any = habitsRow('n1', '2026-08-14T10:00:00.000Z');
        row.entryDate = new Date(2026, 7, 14, 0, 0, 0);
        getFeedStub.resolves([row]);

        const res = makeRes();
        await getJournalFeed(makeReq() as any, res, (() => {}) as any);

        expect(res.body.items[0].entryDate).to.equal('2026-08-14');
    });

    it('breaks ties on id so the ordering is total', async () => {
        // Two items sharing a timestamp must not be able to swap between pages;
        // one of them would never be returned.
        getFeedStub.resolves([habitsRow('bbb', '2026-08-14T10:00:00.000Z')]);
        getCompletedStub.resolves([
            { id: 'aaa', completedAt: '2026-08-14T10:00:00.000Z', achievementClass: 'consistency' },
        ]);

        const res = makeRes();
        await getJournalFeed(makeReq() as any, res, (() => {}) as any);

        expect(res.body.items.map((i: any) => i.id)).to.deep.equal(['bbb', 'aaa']);
    });

    it('reports hasMore and a cursor when more remains', async () => {
        getFeedStub.resolves([
            habitsRow('n1', '2026-08-14T10:00:00.000Z'),
            habitsRow('n2', '2026-08-13T10:00:00.000Z'),
            habitsRow('n3', '2026-08-12T10:00:00.000Z'),
        ]);

        const res = makeRes();
        await getJournalFeed(makeReq({ limit: '2' }) as any, res, (() => {}) as any);

        expect(res.body.items).to.have.length(2);
        expect(res.body.hasMore).to.equal(true);
        expect(res.body.nextCursor).to.equal('2026-08-13T10:00:00.000Z');
    });

    it('reports no cursor at the end of the feed', async () => {
        getFeedStub.resolves([habitsRow('n1', '2026-08-14T10:00:00.000Z')]);

        const res = makeRes();
        await getJournalFeed(makeReq({ limit: '5' }) as any, res, (() => {}) as any);

        expect(res.body.hasMore).to.equal(false);
        expect(res.body.nextCursor).to.equal(null);
    });

    it('filters achievements older than the cursor', async () => {
        // The SQL side applies `before` itself; the achievements side is merged
        // in JS and would otherwise repeat every page.
        getFeedStub.resolves([]);
        getCompletedStub.resolves([
            { id: 'a-new', completedAt: '2026-08-14T10:00:00.000Z', achievementClass: 'consistency' },
            { id: 'a-old', completedAt: '2026-08-10T10:00:00.000Z', achievementClass: 'consistency' },
        ]);

        const res = makeRes();
        await getJournalFeed(
            makeReq({ before: '2026-08-12T00:00:00.000Z' }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.body.items.map((i: any) => i.id)).to.deep.equal(['a-old']);
    });

    it('skips achievements that were never completed', async () => {
        getCompletedStub.resolves([
            { id: 'a1', completedAt: null, achievementClass: 'consistency' },
        ]);

        const res = makeRes();
        await getJournalFeed(makeReq() as any, res, (() => {}) as any);

        expect(res.body.items).to.have.length(0);
    });

    it('passes the cursor through to the store', async () => {
        const res = makeRes();
        await getJournalFeed(
            makeReq({ before: '2026-08-12T00:00:00.000Z', limit: '10' }) as any,
            res,
            (() => {}) as any,
        );

        expect(getFeedStub.firstCall.args[1]).to.equal('2026-08-12T00:00:00.000Z');
        // limit + 1, so the handler can tell "more remains" from "that's all".
        expect(getFeedStub.firstCall.args[2]).to.equal(11);
    });

    it('caps an oversized limit', async () => {
        const res = makeRes();
        await getJournalFeed(makeReq({ limit: '99999' }) as any, res, (() => {}) as any);

        expect(getFeedStub.firstCall.args[2]).to.equal(101);
    });

    it('rejects a malformed cursor', async () => {
        const res = makeRes();
        await getJournalFeed(makeReq({ before: 'not-a-date' }) as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(400);
        expect(getFeedStub.called).to.equal(false);
    });
});
