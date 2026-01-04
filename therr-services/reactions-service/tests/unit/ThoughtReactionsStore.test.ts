/* eslint-disable quotes */
import { expect } from 'chai';
import sinon from 'sinon';
import ThoughtReactionsStore from '../../src/store/ThoughtReactionsStore';

describe('ThoughtReactionsStore', () => {
    const createMockStore = () => ({
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
    });

    describe('getCounts', () => {
        it('returns empty array when no thought IDs provided', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            const result = await store.getCounts([], {});

            expect(result).to.deep.equal([]);
            expect(mockStore.read.query.called).to.be.eq(false);
        });

        it('generates query with correct table and groupBy', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getCounts(['thought-1', 'thought-2'], {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('from "main"."thoughtReactions"');
            expect(query).to.include('group by "thoughtId"');
            expect(query).to.include('"userHasLiked" = true');
            expect(query).to.include("'thought-1'");
            expect(query).to.include("'thought-2'");
        });

        it('uses custom countBy parameter', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getCounts(['thought-1'], {}, 'userHasSuperLiked');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"userHasSuperLiked" = true');
        });

        it('includes additional conditions in query', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getCounts(['thought-1'], { someCondition: true });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"someCondition" = true');
        });
    });

    describe('get', () => {
        it('generates query with conditions and ordering', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select *');
            expect(query).to.include('from "main"."thoughtReactions"');
            expect(query).to.include('"userId" = \'user-1\'');
            expect(query).to.include('order by "createdAt"');
            expect(query).to.include('limit 100');
        });

        it('restricts limit to 1000', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, { limit: 5000, offset: 0, order: 'DESC' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 1000');
            expect(query).to.not.include('limit 5000');
        });

        it('includes thoughtIds filter when provided', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, ['t-1', 't-2']);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"thoughtId" in');
            expect(query).to.include("'t-1'");
            expect(query).to.include("'t-2'");
        });

        it('includes bookmark filter when withBookmark is true', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, { limit: 100, offset: 0, order: 'DESC' }, { withBookmark: true });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"userBookmarkCategory" is not null');
        });

        it('applies custom offset and order', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, { limit: 50, offset: 10, order: 'ASC' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 50');
            expect(query).to.include('offset 10');
            expect(query).to.include('ASC');
        });
    });

    describe('getByThoughtId', () => {
        it('generates query with conditions and default limit', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getByThoughtId({ thoughtId: 'thought-123' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select *');
            expect(query).to.include('from "main"."thoughtReactions"');
            expect(query).to.include('"thoughtId" = \'thought-123\'');
            expect(query).to.include('limit 100');
        });

        it('restricts limit to 1000', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getByThoughtId({ thoughtId: 'thought-123' }, 5000);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 1000');
        });

        it('uses provided limit when under 1000', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getByThoughtId({ thoughtId: 'thought-123' }, 50);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 50');
        });
    });

    describe('create', () => {
        it('generates insert query for single reaction', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.create({
                thoughtId: 'thought-1',
                userId: 'user-1',
                userHasLiked: true,
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into "main"."thoughtReactions"');
            expect(query).to.include("'thought-1'");
            expect(query).to.include("'user-1'");
            expect(query).to.include('returning *');
        });

        it('generates insert query for batch reactions', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.create([
                { thoughtId: 'thought-1', userId: 'user-1' },
                { thoughtId: 'thought-2', userId: 'user-1' },
            ]);

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into "main"."thoughtReactions"');
            expect(query).to.include("'thought-1'");
            expect(query).to.include("'thought-2'");
            expect(query).to.include('returning *');
        });
    });

    describe('update', () => {
        it('generates update query with conditions', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.update(
                { thoughtId: 'thought-1', userId: 'user-1' },
                { userHasLiked: true },
            );

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('update "main"."thoughtReactions"');
            expect(query).to.include('"userHasLiked" = true');
            expect(query).to.include('"thoughtId" = \'thought-1\'');
            expect(query).to.include('"userId" = \'user-1\'');
            expect(query).to.include('returning *');
        });

        it('includes whereIn clause when provided', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.update(
                {},
                { userHasLiked: true },
                {
                    columns: ['userId', 'thoughtId'],
                    whereInArray: [['user-1', 'thought-1'], ['user-2', 'thought-2']],
                },
            );

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('("userId", "thoughtId") in');
            expect(query).to.include("'user-1'");
            expect(query).to.include("'thought-1'");
        });
    });

    describe('delete', () => {
        it('generates delete query', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.delete('user-123');

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('delete from "main"."thoughtReactions"');
            expect(query).to.include('"userId" = \'user-123\'');
        });
    });
});
