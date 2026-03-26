/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import SpacesStore from '../../src/store/SpacesStore';

const createMockStore = () => ({
    read: {
        query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
    },
});

const createMockMediaStore = () => ({
    write: {
        query: sinon.stub().callsFake(() => Promise.resolve({})),
    },
});

const baseConditions = {
    pagination: { itemsPerPage: 20, pageNumber: 1 },
    longitude: -73.9857,
    latitude: 40.7484,
};

describe('SpacesStore', () => {
    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."spaces" where ST_DWithin("geomCenter"::geography, ST_MakePoint(1235.3034, -12.12314)::geography, 1000)`;
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.countRecords({
                longitude: 1235.3034,
                latitude: -12.12314,
                fromUserIds: 'fromUserIds',
            }, [5, 9]);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('searchSpaces', () => {
        it('queries with postgis functions', () => {
            const expected = `select "id", "areaType", "locale", "addressReadable", "category", "websiteUrl", "notificationMsg", "medias", "mediaIds", "hashTags", "latitude", "longitude", "radius", "isMatureContent", "isModeratorApproved", "createdAt", "updatedAt", "featuredIncentiveKey", "featuredIncentiveValue", "featuredIncentiveRewardKey", "featuredIncentiveRewardValue", "featuredIncentiveCurrencyId", "phoneNumber", "isPointOfInterest", "priceRange", "openingHours", "interestsKeys" from "main"."spaces" where ST_DWithin("geomCenter"::geography, ST_MakePoint(15.3034, -1.12314)::geography, 5) and "isMatureContent" = false and "isClaimPending" = false order by ST_Distance("geomCenter"::geography, ST_MakePoint(15.3034, -1.12314)::geography) ASC limit 100 offset 100`;
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
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

        it('sorts by distance when geo coordinates are available', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'distance',
                query: 5000,
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('order by ST_Distance("geomCenter"::geography');
            expect(query).to.include('ASC');
        });

        it('sorts by distance even when filterBy is fromUserIds with coordinates (mobile map use case)', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [], ['user-1', 'user-2']);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('order by ST_Distance("geomCenter"::geography');
            expect(query).to.include('ASC');
            expect(query).to.not.include('"createdAt" desc');
        });

        it('skips geo filter but still sorts by distance for fromUserIds with coordinates', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [], ['user-1', 'user-2']);

            const query = mockStore.read.query.args[0][0];
            // Should NOT have ST_DWithin (geo filter skipped for user ID queries)
            expect(query).to.not.include('ST_DWithin');
            // But SHOULD still sort by distance
            expect(query).to.include('ST_Distance');
        });

        it('falls back to createdAt desc when no coordinates are provided', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [], ['user-1']);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"createdAt" desc');
            expect(query).to.not.include('ST_Distance');
        });

        it('includes fromUserIds filter with public results OR condition', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [], ['user-1', 'user-2']);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"fromUserId" in (');
            expect(query).to.include('"isPublic" = true');
        });

        it('excludes public results when includePublicResults is false', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'fromUserIds',
                query: 'connections',
            }, [], ['user-1'], undefined, false);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"fromUserId" in (');
            expect(query).to.not.include('"isPublic" = true');
        });

        it('applies non-fromUserIds filter without duplicate condition', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'category',
                filterOperator: '=',
                query: 'restaurant',
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"isPublic" = true');
            const categoryMatches = query.match(/"category" = 'restaurant'/g);
            expect(categoryMatches).to.have.lengthOf(1);
        });

        it('applies ilike operator for text search filters', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'notificationMsg',
                filterOperator: 'ilike',
                query: 'pizza',
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('%pizza%');
            expect(query).to.include('ilike');
        });

        it('uses distanceOverride when provided', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
            }, [], [], { distanceOverride: 32000 });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('ST_MakePoint(-73.9857, 40.7484)::geography, 32000)');
        });

        it('calculates correct offset from pagination', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                pagination: { itemsPerPage: 25, pageNumber: 3 },
                filterBy: 'distance',
                query: 5000,
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 25');
            expect(query).to.include('offset 50');
        });

        it('hides claim pending spaces by default', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'distance',
                query: 5000,
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"isClaimPending" = false');
        });

        it('does not filter isClaimPending when filtering by isClaimPending', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchSpaces({
                ...baseConditions,
                filterBy: 'isClaimPending',
                filterOperator: '=',
                query: 'true',
            }, []);

            const query = mockStore.read.query.args[0][0];
            // Should NOT have the default isClaimPending = false in the base where
            // (it will appear in the filter condition instead)
            expect(query).to.not.include('"isClaimPending" = false');
        });
    });

    describe('searchMySpaces', () => {
        it('sorts by createdAt desc', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchMySpaces({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, '*', 'user-123');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"createdAt" desc');
        });

        it('filters by userId and isMatureContent', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchMySpaces({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, '*', 'user-123');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"fromUserId" = \'user-123\'');
            expect(query).to.include('"isMatureContent" = false');
        });

        it('applies filter without duplicate condition', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchMySpaces({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
                filterBy: 'category',
                filterOperator: '=',
                query: 'cafe',
            }, '*', 'user-123');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"isPublic" = true');
            const categoryMatches = query.match(/"category" = 'cafe'/g);
            expect(categoryMatches).to.have.lengthOf(1);
        });

        it('includes organization spaces when provided', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchMySpaces({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, '*', 'user-123', { userOrganizations: ['org-1', 'org-2'] });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"organizationId" in (');
        });

        it('places ORDER BY before LIMIT and OFFSET', () => {
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.searchMySpaces({
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, '*', 'user-123');

            const query = mockStore.read.query.args[0][0];
            const orderIdx = query.indexOf('"createdAt" desc');
            const limitIdx = query.indexOf('limit');
            expect(orderIdx).to.be.greaterThan(0);
            expect(orderIdx).to.be.lessThan(limitIdx);
        });
    });

    describe('getById', () => {
        it('queries with a join request', () => {
            const mockId = '12345';
            const expected = `select "main"."spaces"."id", "main"."spaces"."fromUserId", "main"."spaces"."notificationMsg", "main"."spaceIncentives"."id" as "incentives[].id", "main"."spaceIncentives"."incentiveKey" as "incentives[].incentiveKey", "main"."spaceIncentives"."incentiveValue" as "incentives[].incentiveValue", "main"."spaceIncentives"."incentiveRewardKey" as "incentives[].incentiveRewardKey", "main"."spaceIncentives"."incentiveRewardValue" as "incentives[].incentiveRewardValue", "main"."spaceIncentives"."incentiveCurrencyId" as "incentives[].incentiveCurrencyId", "main"."spaceIncentives"."isActive" as "incentives[].isActive", "main"."spaceIncentives"."isFeatured" as "incentives[].isFeatured", "main"."spaceIncentives"."maxUseCount" as "incentives[].maxUseCount", "main"."spaceIncentives"."minUserDataProps" as "incentives[].minUserDataProps", "main"."spaceIncentives"."region" as "incentives[].region", "main"."spaceIncentives"."requiredUserDataProps" as "incentives[].requiredUserDataProps", "main"."spaceIncentives"."startsAt" as "incentives[].startsAt", "main"."spaceIncentives"."endsAt" as "incentives[].endsAt" from "main"."spaces" left join "main"."spaceIncentives" on "main"."spaces"."id" = "main"."spaceIncentives"."spaceId" where "main"."spaces"."id" = '${mockId}'`;
            const mockStore = createMockStore();
            const store = new SpacesStore(mockStore, createMockMediaStore());
            store.getById(mockId);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });
});
