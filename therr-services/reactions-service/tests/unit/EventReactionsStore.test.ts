/* eslint-disable quotes */
import { expect } from 'chai';
import sinon from 'sinon';
import EventReactionsStore from '../../src/store/EventReactionsStore';

describe('EventReactionsStore', () => {
    const createMockStore = () => ({
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
    });

    describe('getCounts', () => {
        it('returns empty array when no event IDs provided', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            const result = await store.getCounts([], {});

            expect(result).to.deep.equal([]);
            expect(mockStore.read.query.called).to.be.eq(false);
        });

        it('generates query with correct table and groupBy', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getCounts(['event-1', 'event-2'], {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('from "main"."eventReactions"');
            expect(query).to.include('group by "eventId"');
            expect(query).to.include('"userHasLiked" = true');
            expect(query).to.include("'event-1'");
            expect(query).to.include("'event-2'");
        });

        it('uses custom countBy parameter', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getCounts(['event-1'], {}, 'userHasSuperLiked');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"userHasSuperLiked" = true');
        });

        it('includes additional conditions in query', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getCounts(['event-1'], { someCondition: true });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"someCondition" = true');
        });
    });

    describe('get', () => {
        it('generates query with conditions and ordering', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.get({ userId: 'user-1' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select *');
            expect(query).to.include('from "main"."eventReactions"');
            expect(query).to.include('"userId" = \'user-1\'');
            expect(query).to.include('order by "createdAt"');
            expect(query).to.include('limit 100');
        });

        it('restricts limit to 1000', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, undefined, { limit: 5000, offset: 0, order: 'DESC' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 1000');
            expect(query).to.not.include('limit 5000');
        });

        it('includes eventIds filter when provided', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, ['e-1', 'e-2']);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"eventId" in');
            expect(query).to.include("'e-1'");
            expect(query).to.include("'e-2'");
        });

        it('includes userIds filter when provided', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.get({ eventId: 'event-1' }, undefined, ['u-1', 'u-2']);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"userId" in');
            expect(query).to.include("'u-1'");
            expect(query).to.include("'u-2'");
        });

        it('includes bookmark filter when withBookmark is true', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, undefined, { limit: 100, offset: 0, order: 'DESC' }, { withBookmark: true });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"userBookmarkCategory" is not null');
        });

        it('applies custom offset and order', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, undefined, { limit: 50, offset: 10, order: 'ASC' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 50');
            expect(query).to.include('offset 10');
            expect(query).to.include('ASC');
        });
    });

    describe('getByEventId', () => {
        it('generates query with conditions and default limit', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getByEventId({ eventId: 'event-123' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select *');
            expect(query).to.include('from "main"."eventReactions"');
            expect(query).to.include('"eventId" = \'event-123\'');
            expect(query).to.include('limit 100');
        });

        it('restricts limit to 1000', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getByEventId({ eventId: 'event-123' }, 5000);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 1000');
        });

        it('uses provided limit when under 1000', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getByEventId({ eventId: 'event-123' }, 50);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 50');
        });
    });

    describe('getRatingsByEventId', () => {
        it('generates query with default limit', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getRatingsByEventId({ eventId: 'event-123' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select "rating"');
            expect(query).to.include('from "main"."eventReactions"');
            expect(query).to.include('"rating" is not null');
            expect(query).to.include('limit 1000');
        });

        it('restricts limit to 5000', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getRatingsByEventId({ eventId: 'event-123' }, 10000);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 5000');
        });

        it('uses provided limit when under 5000', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getRatingsByEventId({ eventId: 'event-123' }, 500);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 500');
        });

        it('includes additional conditions in query', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.getRatingsByEventId({ eventId: 'event-123', someCondition: true });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"someCondition" = true');
        });
    });

    describe('create', () => {
        it('generates insert query for single reaction', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.create({
                eventId: 'event-1',
                userId: 'user-1',
                userHasLiked: true,
                rating: 5,
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into "main"."eventReactions"');
            expect(query).to.include("'event-1'");
            expect(query).to.include("'user-1'");
            expect(query).to.include('returning *');
        });

        it('generates insert query for batch reactions', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.create([
                { eventId: 'event-1', userId: 'user-1' },
                { eventId: 'event-2', userId: 'user-1' },
            ]);

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into "main"."eventReactions"');
            expect(query).to.include("'event-1'");
            expect(query).to.include("'event-2'");
            expect(query).to.include('returning *');
        });
    });

    describe('update', () => {
        it('generates update query with conditions', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.update(
                { eventId: 'event-1', userId: 'user-1' },
                { userHasLiked: true, rating: 4 },
            );

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('update "main"."eventReactions"');
            expect(query).to.include('"userHasLiked" = true');
            expect(query).to.include('"rating" = 4');
            expect(query).to.include('"eventId" = \'event-1\'');
            expect(query).to.include('"userId" = \'user-1\'');
            expect(query).to.include('"updateCount" + 1');
            expect(query).to.include('returning *');
        });

        it('includes whereIn clause when provided', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.update(
                {},
                { userHasLiked: true },
                {
                    columns: ['userId', 'eventId'],
                    whereInArray: [['user-1', 'event-1'], ['user-2', 'event-2']],
                },
            );

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('("userId", "eventId") in');
            expect(query).to.include("'user-1'");
            expect(query).to.include("'event-1'");
        });

        it('does not add whereIn clause when whereInArray is empty', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.update(
                { eventId: 'event-1' },
                { userHasLiked: true },
                {
                    columns: ['userId', 'eventId'],
                    whereInArray: [],
                },
            );

            const query = mockStore.write.query.args[0][0];
            expect(query).to.not.include(' in ((');
        });
    });

    describe('delete', () => {
        it('generates delete query', async () => {
            const mockStore = createMockStore();
            const store = new EventReactionsStore(mockStore);

            store.delete('user-123');

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('delete from "main"."eventReactions"');
            expect(query).to.include('"userId" = \'user-123\'');
        });
    });
});
