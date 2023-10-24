/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import SpacesStore from '../../src/store/SpacesStore';

describe('SpacesStore', () => {
    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."spaces" where ST_DWithin(geom, ST_MakePoint(1235.3034, -12.12314)::geography, 1000)`;
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
            const store = new SpacesStore(mockStore, mockMediaStore);
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
            const expected = `select * from "main"."spaces" where ST_DWithin(geom, ST_MakePoint(15.3034, -1.12314)::geography, 5) and "isClaimPending" = false and "isMatureContent" = false limit 100 offset 100`;
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
            const store = new SpacesStore(mockStore, mockMediaStore);
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
    });

    describe('getById', () => {
        it('queries with a join request', () => {
            const mockId = '12345';
            const expected = `select "main"."spaces"."id", "main"."spaces"."fromUserId", "main"."spaces"."notificationMsg", "main"."spaceIncentives"."id" as "incentives[].id", "main"."spaceIncentives"."incentiveKey" as "incentives[].incentiveKey", "main"."spaceIncentives"."incentiveValue" as "incentives[].incentiveValue", "main"."spaceIncentives"."incentiveRewardKey" as "incentives[].incentiveRewardKey", "main"."spaceIncentives"."incentiveRewardValue" as "incentives[].incentiveRewardValue", "main"."spaceIncentives"."incentiveCurrencyId" as "incentives[].incentiveCurrencyId", "main"."spaceIncentives"."isActive" as "incentives[].isActive", "main"."spaceIncentives"."isFeatured" as "incentives[].isFeatured", "main"."spaceIncentives"."maxUseCount" as "incentives[].maxUseCount", "main"."spaceIncentives"."minUserDataProps" as "incentives[].minUserDataProps", "main"."spaceIncentives"."region" as "incentives[].region", "main"."spaceIncentives"."requiredUserDataProps" as "incentives[].requiredUserDataProps", "main"."spaceIncentives"."startsAt" as "incentives[].startsAt", "main"."spaceIncentives"."endsAt" as "incentives[].endsAt" from "main"."spaces" left join "main"."spaceIncentives" on "main"."spaces"."id" = "main"."spaceIncentives"."spaceId" where "main"."spaces"."id" = '${mockId}'`;
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
            const store = new SpacesStore(mockStore, mockMediaStore);
            store.getById(mockId);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });
});
