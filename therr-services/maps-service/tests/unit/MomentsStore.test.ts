/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import MomentsStore from '../../src/store/MomentsStore';

describe('MomentsStore', () => {
    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."moments" where ST_DWithin(geom, ST_MakePoint(1235.3034, -12.12314)::geography, 1000)`;
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
        it('queries with postgis functions', () => {
            const expected = `select "id", "areaType", "locale", "category", "notificationMsg", "medias", "mediaIds", "hashTags", "latitude", "longitude", "radius", "isMatureContent", "isModeratorApproved", "createdAt", "updatedAt", "interestsKeys", "spaceId" from "main"."moments" where ST_DWithin(geom, ST_MakePoint(15.3034, -1.12314)::geography, 5) and "isMatureContent" = false limit 100 offset 100`;
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

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });
});
