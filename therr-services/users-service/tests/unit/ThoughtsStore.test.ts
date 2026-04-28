/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import ThoughtsStore from '../../src/store/ThoughtsStore';

const buildMockConnection = () => {
    const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    const writeStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    return {
        connection: {
            read: { query: readStub } as any,
            write: { query: writeStub } as any,
        },
        readStub,
        writeStub,
    };
};

const stubUsersStore: any = {
    findUsers: () => Promise.resolve([]),
};

describe('ThoughtsStore brand filtering', () => {
    describe('search', () => {
        it('does NOT add a brand filter when caller is therr (allowlist=all)', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search(BrandVariations.THERR, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include('brandVariation');
        });

        it('restricts to HABITS rows when caller is habits', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search(BrandVariations.HABITS, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
        });

        it('restricts to TEEM rows when caller is teem', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search(BrandVariations.TEEM, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('teem')`);
            expect(sql).to.not.include(`'habits'`);
        });

        it('falls back to a self-only allowlist for unknown brands', () => {
            // An unknown/empty brand should NEVER fall through to "see everything" —
            // the helper returns [brand] so the where clause is "brandVariation = '<unknown>'",
            // which matches no rows. This is the safe direction.
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search('mystery-brand' as any, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('mystery-brand')`);
        });
    });

    describe('find', () => {
        it('omits brand filter for therr (allowlist=all)', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.THERR, [], { limit: 21, before: '2026-04-27T00:00:00.000Z' });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include('brandVariation');
        });

        it('applies brand filter for habits AND mirrors it onto the reply self-join', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.HABITS, ['t1'], {
                limit: 21,
                before: '2026-04-27T00:00:00.000Z',
            }, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            // Top-level brand filter
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
            // Self-join brand filter (closing leak: HABITS reader must not see therr replies on a habits parent)
            expect(sql).to.include(`replies."brandVariation" IN ('habits')`);
        });
    });

    describe('getById', () => {
        it('applies brand filter and mirrors onto reply self-join when habits', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getById(BrandVariations.HABITS, 'thought-1', {}, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
            expect(sql).to.include(`replies."brandVariation" IN ('habits')`);
        });

        it('does not filter by brand for therr', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getById(BrandVariations.THERR, 'thought-1', {}, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include('brandVariation');
        });
    });

    describe('create', () => {
        it('stamps the row with the caller brand on insert (habits)', () => {
            const { connection, writeStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.create(BrandVariations.HABITS, {
                fromUserId: 1 as any,
                locale: 'en-us',
                message: 'hello',
            });

            const sql = writeStub.args[0][0] as string;
            expect(sql).to.include(`"brandVariation"`);
            expect(sql).to.include(`'habits'`);
        });

        it('stamps the row with therr when caller is therr (legacy default behavior)', () => {
            // Simulates a legacy token (no x-brand-variation header) that getBrandContext
            // resolved to THERR. The insert MUST stamp 'therr' so the row stays visible to Therr.
            const { connection, writeStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.create(BrandVariations.THERR, {
                fromUserId: 1 as any,
                locale: 'en-us',
                message: 'hello legacy',
            });

            const sql = writeStub.args[0][0] as string;
            expect(sql).to.include(`'therr'`);
        });
    });

    describe('get (duplicate check)', () => {
        it('scopes the duplicate check to the caller brand for habits', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.get(BrandVariations.HABITS, {
                fromUserId: 1,
                message: 'hi',
            });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
        });
    });
});
