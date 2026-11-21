import { expect } from 'chai';
import sinon from 'sinon';
import DropsStore from '../../src/store/DropsStore';

const SENDER = '11111111-1111-4111-8111-111111111111';
const RECIPIENT = '22222222-2222-4222-8222-222222222222';
const DROP_ID = '44444444-4444-4444-8444-444444444444';

const buildMockDb = () => ({
    read: { query: sinon.stub().resolves({ rows: [], rowCount: 0 }) },
    write: { query: sinon.stub().resolves({ rows: [], rowCount: 0 }) },
});

/**
 * `main.drops` is brand-scoped (eslint-config/brand-scoped-tables.js), and every read must also be
 * scoped to the requester as sender or recipient. These pin both predicates into the SQL itself.
 */
describe('DropsStore', () => {
    it('refuses to run without a brand', async () => {
        const db = buildMockDb();
        const store = new DropsStore(db as any);

        expect(() => store.listSent('' as any, SENDER)).to.throw();
        expect(db.read.query.called).to.equal(false);
    });

    it('scopes a single-drop read to the brand and to the requester as sender or recipient', async () => {
        const db = buildMockDb();
        const store = new DropsStore(db as any);

        await store.getForParticipant('therr', DROP_ID, RECIPIENT);
        const sql = db.read.query.args[0][0];

        expect(sql).to.contain('"main"."drops"."brandVariation" = \'therr\'');
        expect(sql).to.contain(`"main"."drops"."id" = '${DROP_ID}'`);
        expect(sql).to.contain(`("main"."drops"."fromUserId" = '${RECIPIENT}' or "main"."drops"."toUserId" = '${RECIPIENT}')`);
    });

    it('lists the inbox without dismissed drops, keeping opened ones and recently expired ones', async () => {
        const db = buildMockDb();
        const store = new DropsStore(db as any);

        await store.listReceived('therr', RECIPIENT, new Date('2026-11-21T12:00:00.000Z'));
        const sql = db.read.query.args[0][0];

        expect(sql).to.contain(`"main"."drops"."toUserId" = '${RECIPIENT}'`);
        expect(sql).to.contain('"main"."drops"."recipientDismissedAt" is null');
        expect(sql).to.contain('"main"."drops"."openedAt" is not null or "main"."drops"."expiresAt" > \'2026-11-14T12:00:00.000Z\'');
        expect(sql).to.contain('"main"."drops"."brandVariation" = \'therr\'');
    });

    it('stamps every row of a multi-recipient drop with the brand', async () => {
        const db = buildMockDb();
        const store = new DropsStore(db as any);
        const base = {
            batchId: '55555555-5555-4555-8555-555555555555',
            fromUserId: SENDER,
            message: 'hi',
            mediaPath: null,
            mediaType: null,
            latitude: 41.88,
            longitude: -87.62,
            unlockRadiusMeters: 100,
            placeName: null,
            spaceId: null,
            expiresAt: new Date('2026-12-21T12:00:00.000Z'),
        };

        await store.createMany('therr', [
            { ...base, toUserId: RECIPIENT },
            { ...base, toUserId: '33333333-3333-4333-8333-333333333333' },
        ]);
        const sql: string = db.write.query.args[0][0];

        expect(sql.startsWith('insert into "main"."drops"')).to.equal(true);
        expect(sql.match(/'therr'/g)?.length).to.equal(2);
        expect(sql).to.contain('returning *');
    });

    it('marks a drop opened only for its recipient and only the first time', async () => {
        const db = buildMockDb();
        const store = new DropsStore(db as any);

        await store.markOpened('therr', DROP_ID, RECIPIENT, new Date('2026-11-21T12:00:00.000Z'));
        const sql = db.write.query.args[0][0];

        expect(sql).to.contain(`"toUserId" = '${RECIPIENT}'`);
        expect(sql).to.contain('"main"."drops"."openedAt" is null');
        expect(sql).to.contain('"main"."drops"."brandVariation" = \'therr\'');
    });

    it('lets only the sender delete', async () => {
        const db = buildMockDb();
        const store = new DropsStore(db as any);

        await store.deleteForSender('therr', DROP_ID, SENDER);
        const sql = db.write.query.args[0][0];

        expect(sql.startsWith('delete from "main"."drops"')).to.equal(true);
        expect(sql).to.contain(`"fromUserId" = '${SENDER}'`);
    });
});
