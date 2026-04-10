/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import SpaceDisplayRequestsStore from '../../src/store/SpaceDisplayRequestsStore';

const createMockWriteStore = () => ({
    write: {
        query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
    },
});

const createMockReadStore = () => ({
    read: {
        query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
    },
});

describe('SpaceDisplayRequestsStore', () => {
    describe('create', () => {
        it('inserts into spaceDisplayRequests with all required fields', () => {
            const mockStore = createMockWriteStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.create({
                spaceId: 'space-111',
                fromUserId: 'user-222',
                displayType: 'coaster',
                shippingName: 'Joe Bloggs',
                shippingAddress: '123 Main St',
                shippingCity: 'Austin',
                shippingRegion: 'TX',
                shippingPostalCode: '78701',
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into');
            expect(query).to.include('"spaceDisplayRequests"');
            expect(query).to.include("'space-111'");
            expect(query).to.include("'user-222'");
            expect(query).to.include("'coaster'");
            expect(query).to.include("'Joe Bloggs'");
            expect(query).to.include('returning *');
        });

        it('defaults shippingCountry to US when not provided', () => {
            const mockStore = createMockWriteStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.create({
                spaceId: 'space-aaa',
                fromUserId: 'user-bbb',
                displayType: 'table_tent',
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include("'US'");
        });

        it('uses provided shippingCountry when supplied', () => {
            const mockStore = createMockWriteStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.create({
                spaceId: 'space-ccc',
                fromUserId: 'user-ddd',
                displayType: 'window_cling',
                shippingCountry: 'CA',
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include("'CA'");
        });
    });

    describe('list', () => {
        it('queries spaceDisplayRequests ordered by requestedAt desc', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.list();

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"spaceDisplayRequests"');
            expect(query).to.include('"requestedAt" desc');
        });

        it('applies status filter when provided', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.list({ status: 'pending' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include(`"status" = 'pending'`);
        });

        it('applies spaceId filter when provided', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.list({ spaceId: 'space-xyz' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include(`"spaceId" = 'space-xyz'`);
        });

        it('applies fromUserId filter when provided', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.list({ fromUserId: 'user-xyz' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include(`"fromUserId" = 'user-xyz'`);
        });

        it('applies default limit of 100', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.list();

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 100');
        });

        it('applies custom limit and offset', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.list({ limit: 25, offset: 50 });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 25');
            expect(query).to.include('offset 50');
        });
    });

    describe('listPendingWithSpaceInfo', () => {
        it('joins main.spaces and filters by status = pending', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.listPendingWithSpaceInfo();

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('main."spaceDisplayRequests"');
            expect(query).to.include('main.spaces');
            expect(query).to.include(`status = 'pending'`);
        });

        it('selects business name and address fields from spaces join', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.listPendingWithSpaceInfo();

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"notificationMsg"');
            expect(query).to.include('"addressStreetAddress"');
            expect(query).to.include('"addressLocality"');
            expect(query).to.include('"addressRegion"');
        });

        it('orders results by requestedAt ASC for FIFO fulfillment', () => {
            const mockStore = createMockReadStore();
            const store = new SpaceDisplayRequestsStore(mockStore as any);

            store.listPendingWithSpaceInfo();

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"requestedAt" ASC');
        });
    });
});
