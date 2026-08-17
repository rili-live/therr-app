import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { createJournalEntry, getJournalFeed, updateJournalEntry } from '../../src/handlers/journal';

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
        // The cursor carries the id as well as the instant, so the next page can
        // resume *within* a group of items sharing a timestamp.
        expect(res.body.nextCursor).to.equal('2026-08-13T10:00:00.000Z|n2');
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
            makeReq({ before: '2026-08-12T00:00:00.000Z|entry-9', limit: '10' }) as any,
            res,
            (() => {}) as any,
        );

        expect(getFeedStub.firstCall.args[1]).to.deep.equal({
            occurredAt: '2026-08-12T00:00:00.000Z',
            id: 'entry-9',
        });
        // limit + 1, so the handler can tell "more remains" from "that's all".
        expect(getFeedStub.firstCall.args[2]).to.equal(11);
    });

    it('accepts a bare-ISO cursor from an earlier build', async () => {
        // A client mid-scroll across a deploy still holds a timestamp-only
        // cursor. It must keep paging rather than get a 400 — with a null id,
        // which the store treats as timestamp-exclusive (the old behaviour).
        const res = makeRes();
        await getJournalFeed(
            makeReq({ before: '2026-08-12T00:00:00.000Z' }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.statusCode).to.equal(200);
        expect(getFeedStub.firstCall.args[1]).to.deep.equal({
            occurredAt: '2026-08-12T00:00:00.000Z',
            id: null,
        });
    });

    it('does not drop an achievement that shares the cursor instant', async () => {
        // The regression this pagination exists to prevent. Page 1 ends on a
        // habits row; an achievement shares its exact instant and sorts after it
        // by id. A timestamp-only cursor excluded everything at that instant, so
        // the achievement was skipped on page 2 and never returned again.
        const sharedInstant = '2026-08-14T10:00:00.000Z';

        getFeedStub.resolves([]);
        getCompletedStub.resolves([
            { id: 'aaa', completedAt: sharedInstant, achievementClass: 'consistency' },
        ]);

        const res = makeRes();
        await getJournalFeed(
            // Cursor is the page-1 boundary: same instant, a higher id.
            makeReq({ before: `${sharedInstant}|bbb` }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.body.items.map((i: any) => i.id)).to.deep.equal(['aaa']);
    });

    it('still excludes the boundary row itself', async () => {
        // The cursor is exclusive on the pair, so the item it was minted from
        // must not come back on the next page.
        const sharedInstant = '2026-08-14T10:00:00.000Z';

        getFeedStub.resolves([]);
        getCompletedStub.resolves([
            { id: 'aaa', completedAt: sharedInstant, achievementClass: 'consistency' },
        ]);

        const res = makeRes();
        await getJournalFeed(
            makeReq({ before: `${sharedInstant}|aaa` }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.body.items).to.have.length(0);
    });

    it('excludes an achievement that sorts before the cursor at the same instant', async () => {
        const sharedInstant = '2026-08-14T10:00:00.000Z';

        getFeedStub.resolves([]);
        getCompletedStub.resolves([
            { id: 'zzz', completedAt: sharedInstant, achievementClass: 'consistency' },
        ]);

        const res = makeRes();
        await getJournalFeed(
            makeReq({ before: `${sharedInstant}|bbb` }) as any,
            res,
            (() => {}) as any,
        );

        // 'zzz' > 'bbb', so it belongs to the page already served.
        expect(res.body.items).to.have.length(0);
    });

    it('round-trips its own cursor across a tie without losing or repeating an item', async () => {
        // End-to-end over the handler's half of the pagination: three items at
        // one instant, paged one at a time, must yield each exactly once.
        const sharedInstant = '2026-08-14T10:00:00.000Z';
        const ids = ['ccc', 'bbb', 'aaa'];

        getFeedStub.resolves([]);
        getCompletedStub.resolves(ids.map((id) => ({
            id,
            completedAt: sharedInstant,
            achievementClass: 'consistency',
        })));

        const seen: string[] = [];
        let nextCursor: string | null = null;

        for (let page = 0; page < ids.length; page += 1) {
            const res = makeRes();
            const query: any = { limit: '1' };
            if (nextCursor) {
                query.before = nextCursor;
            }
            // eslint-disable-next-line no-await-in-loop
            await getJournalFeed(makeReq(query) as any, res, (() => {}) as any);

            seen.push(...res.body.items.map((i: any) => i.id));
            nextCursor = res.body.nextCursor;
        }

        expect(seen).to.deep.equal(['ccc', 'bbb', 'aaa']);
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

/**
 * The write endpoints have to return the same `entryDate` shape the feed does.
 *
 * `entryDate` is a `date` column, so node-pg hands back a Date at LOCAL
 * midnight and Express serializes it with toISOString(). Returned raw, a row
 * stored as 2026-08-17 goes out as "2026-08-17T05:00:00.000Z" on a UTC-05:00
 * server and "2026-08-16T15:00:00.000Z" on a UTC+09:00 one — the wrong day
 * outright, even for a client that splits on "T". Clients key day-grouping on
 * this field, so a mismatch files a freshly-written note under a phantom day.
 */
describe('Journal entry writes', () => {
    const storedRow = () => ({
        id: 'entry-1',
        userId: 'user-1',
        habitGoalId: null,
        checkinId: null,
        body: 'I woke up before the alarm',
        // What node-pg actually produces for a `date` column holding 2026-08-17.
        entryDate: new Date(2026, 7, 17, 0, 0, 0),
        occurredAt: new Date('2026-08-17T14:30:00.000Z'),
        createdAt: new Date('2026-08-17T14:30:00.000Z'),
        updatedAt: new Date('2026-08-17T14:30:00.000Z'),
    });

    afterEach(() => {
        sinon.restore();
    });

    it('returns entryDate as a bare calendar day when creating an entry', async () => {
        const createStub = sinon.stub(Store.journalEntries, 'create').resolves(storedRow() as any);
        const res = makeRes();
        const req: any = makeReq();
        req.body = { body: 'I woke up before the alarm', entryDate: '2026-08-17' };

        await createJournalEntry(req, res, (() => {}) as any);

        expect(createStub.calledOnce).to.equal(true);
        expect(res.statusCode).to.equal(201);
        expect(res.body.entryDate).to.equal('2026-08-17');
        expect(res.body.occurredAt).to.equal('2026-08-17T14:30:00.000Z');
    });

    it('returns entryDate as a bare calendar day when updating an entry', async () => {
        sinon.stub(Store.journalEntries, 'update').resolves(storedRow() as any);
        const res = makeRes();
        const req: any = makeReq();
        req.params = { id: 'entry-1' };
        req.body = { body: 'edited' };

        await updateJournalEntry(req, res, (() => {}) as any);

        expect(res.statusCode).to.equal(200);
        expect(res.body.entryDate).to.equal('2026-08-17');
    });

    it('does not roll the day back for a positive-offset server timezone', async () => {
        // The pre-fix code returned toISOString() of local midnight, which in
        // UTC+09:00 is the previous day at 15:00Z.
        sinon.stub(Store.journalEntries, 'create').resolves(storedRow() as any);
        const res = makeRes();
        const req: any = makeReq();
        req.body = { body: 'note', entryDate: '2026-08-17' };

        await createJournalEntry(req, res, (() => {}) as any);

        expect(res.body.entryDate.startsWith('2026-08-17')).to.equal(true);
        expect(res.body.entryDate).to.not.contain('T');
    });
});
