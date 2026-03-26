/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import MomentsStore from '../../src/store/MomentsStore';

describe('MomentsStore', () => {
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

    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."moments" where ST_DWithin(geom::geography, ST_MakePoint(1235.3034, -12.12314)::geography, 1000)`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const mockMediaStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new MomentsStore(mockStore, mockMediaStore);
            store.countRecords({
                longitude: 1235.3034,
                latitude: -12.12314,
                fromUserIds: 'fromUserIds',
            }, [5, 9]);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('searchMoments', () => {
        it('queries with postgis functions and expiresAt filter', () => {
            const mockStore = createMockStore();
            const mockMediaStore = createMockMediaStore();
            const mockHeaders = {
                'x-platform': 'mobile',
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
                'x-username': 'testUser',
            };
            const store = new MomentsStore(mockStore, mockMediaStore);
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

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"isMatureContent" = false');
            expect(query).to.include('ST_DWithin');
            expect(query).to.include('ST_Distance');
        });

        it('includes expiresAt filter to exclude expired moments', () => {
            const mockStore = createMockStore();
            const mockMediaStore = createMockMediaStore();
            const mockHeaders = {
                'x-platform': 'mobile',
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
                'x-username': 'testUser',
            };
            const store = new MomentsStore(mockStore, mockMediaStore);
            store.searchMoments(mockHeaders, {
                pagination: {
                    itemsPerPage: 10,
                    pageNumber: 1,
                },
                filterBy: 'distance',
                query: 1000,
                longitude: 0,
                latitude: 0,
            }, []);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"expiresAt" is null');
            expect(query).to.include('"expiresAt" >');
        });
    });

    describe('getQuickReportsSummary', () => {
        it('queries for quick report moments grouped by category', () => {
            const mockStore = createMockStore();
            const mockMediaStore = createMockMediaStore();
            const store = new MomentsStore(mockStore, mockMediaStore);
            store.getQuickReportsSummary('space-123');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select "category"');
            expect(query).to.include('count(');
            expect(query).to.include('max(');
            expect(query).to.include('"spaceId" = \'space-123\'');
            expect(query).to.include('group by "category"');
        });

        it('filters by non-expired moments', () => {
            const mockStore = createMockStore();
            const mockMediaStore = createMockMediaStore();
            const store = new MomentsStore(mockStore, mockMediaStore);
            store.getQuickReportsSummary('space-456');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"expiresAt" is null');
            expect(query).to.include('"expiresAt" >');
        });

        it('filters by isMatureContent false', () => {
            const mockStore = createMockStore();
            const mockMediaStore = createMockMediaStore();
            const store = new MomentsStore(mockStore, mockMediaStore);
            store.getQuickReportsSummary('space-789');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"isMatureContent" = false');
        });

        it('filters only quick report categories', () => {
            const mockStore = createMockStore();
            const mockMediaStore = createMockMediaStore();
            const store = new MomentsStore(mockStore, mockMediaStore);
            store.getQuickReportsSummary('space-abc');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"category" in');
            expect(query).to.include('categories.deals');
            expect(query).to.include('categories.warning');
            expect(query).to.include('categories.happeningNow');
            expect(query).to.include('categories.longWait');
            expect(query).to.include('categories.liveEntertainment');
        });
    });
});
