/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import MomentsStore from '../../src/store/MomentsStore';

// Use a never-resolving promise to avoid triggering .then() handlers that access undefined overrides
const createMockStore = () => ({
    read: {
        query: sinon.stub().callsFake(() => new Promise(() => {})),
    },
});

const createMockMediaStore = () => ({
    write: {
        query: sinon.stub().callsFake(() => Promise.resolve({})),
    },
});

const mockHeaders = {
    'x-platform': 'mobile',
    'x-brand-variation': 'therr',
    'x-localecode': 'en-us',
    'x-username': 'testUser',
};

const baseConditions = {
    pagination: { itemsPerPage: 20, pageNumber: 1 },
    longitude: -73.9857,
    latitude: 40.7484,
};

describe('MomentsStore', () => {
    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."moments" where ST_DWithin(geom::geography, ST_MakePoint(1235.3034, -12.12314)::geography, 1000)`;
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.countRecords({
                longitude: 1235.3034,
                latitude: -12.12314,
                fromUserIds: 'fromUserIds',
            }, [5, 9]);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('searchMoments', () => {
        it('queries with postgis functions and distance sort', () => {
            const expected = `select "id", "areaType", "locale", "category", "notificationMsg", "medias", "mediaIds", "hashTags", "latitude", "longitude", "radius", "isMatureContent", "isModeratorApproved", "createdAt", "updatedAt", "interestsKeys", "spaceId" from "main"."moments" where ST_DWithin(geom::geography, ST_MakePoint(15.3034, -1.12314)::geography, 5) and "isMatureContent" = false order by ST_Distance(geom::geography, ST_MakePoint(15.3034, -1.12314)::geography) ASC limit 100 offset 100`;
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                pagination: {
                    itemsPerPage: 100,
                    pageNumber: 2,
                },
                filterBy: 'distance',
                filterOperator: '>',
                query: 5,
                longitude: 15.3034,
                latitude: -1.12314,
                order: 'desc',
            }, []);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });

        it('always includes ORDER BY ST_Distance ASC regardless of filter type', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
                filterBy: 'distance',
                query: 5000,
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('order by ST_Distance(geom::geography');
            expect(query).to.include('ASC');
        });

        it('sorts by distance even when filterBy is fromUserIds (mobile map use case)', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [] as any, ['user-1', 'user-2'] as any);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('order by ST_Distance(geom::geography');
            expect(query).to.include('ASC');
            expect(query).to.not.include('"createdAt" desc');
        });

        it('includes fromUserIds filter with public results OR condition', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [] as any, ['user-1', 'user-2'] as any);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"fromUserId" in (');
            expect(query).to.include('"isPublic" = true');
        });

        it('excludes public results when includePublicResults is false', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [] as any, ['user-1'] as any, undefined, false);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"fromUserId" in (');
            expect(query).to.not.include('"isPublic" = true');
        });

        it('applies non-fromUserIds filter without duplicate condition', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
                filterBy: 'category',
                filterOperator: '=',
                query: 'food',
            }, []);

            const query = mockStore.read.query.args[0][0];
            // Should have the grouped condition with OR isPublic
            expect(query).to.include('"isPublic" = true');
            // Should NOT have a duplicate bare andWhere before the grouped condition
            // The filter should appear exactly once in the main clause (inside the grouped condition)
            const categoryMatches = query.match(/"category" = 'food'/g);
            expect(categoryMatches).to.have.lengthOf(1);
        });

        it('applies ilike operator for text search filters', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
                filterBy: 'notificationMsg',
                filterOperator: 'ilike',
                query: 'coffee',
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('%coffee%');
            expect(query).to.include('ilike');
        });

        it('uses distanceOverride when provided', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
            }, [], [], { distanceOverride: 32000 });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('ST_MakePoint(-73.9857, 40.7484)::geography, 32000)');
        });

        it('calculates correct offset from pagination', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMoments(mockHeaders, {
                ...baseConditions,
                pagination: { itemsPerPage: 25, pageNumber: 3 },
                filterBy: 'distance',
                query: 5000,
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 25');
            expect(query).to.include('offset 50');
        });
    });

    describe('searchMyMoments', () => {
        const requirements = { fromUserId: 'user-123', isMatureContent: false };

        it('sorts by distance when coordinates are provided', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMyMoments(mockHeaders, 'user-123', requirements, {
                ...baseConditions,
            }, '*', {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('order by ST_Distance(geom::geography');
            expect(query).to.include('ASC');
            expect(query).to.not.include('"createdAt" desc');
        });

        it('falls back to createdAt desc when no coordinates provided', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMyMoments(mockHeaders, 'user-123', requirements, {
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, '*', {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"createdAt" desc');
            expect(query).to.not.include('ST_Distance');
        });

        it('applies ST_DWithin geo filter when coordinates are provided', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMyMoments(mockHeaders, 'user-123', requirements, {
                ...baseConditions,
            }, '*', {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('ST_DWithin(geom::geography');
        });

        it('skips ST_DWithin geo filter when no coordinates', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMyMoments(mockHeaders, 'user-123', requirements, {
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, '*', {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.not.include('ST_DWithin');
        });

        it('uses default limit of 50 when limit is not set', () => {
            const mockStore = createMockStore();
            const store = new MomentsStore(mockStore, createMockMediaStore());
            store.searchMyMoments(mockHeaders, 'user-123', requirements, {
                pagination: { itemsPerPage: 0, pageNumber: 1 },
            }, '*', {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 50');
        });
    });
});
