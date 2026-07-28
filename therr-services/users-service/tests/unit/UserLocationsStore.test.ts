/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { Location } from 'therr-js-utilities/constants';
import UserLocationsStore from '../../src/store/UserLocationsStore';

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

describe('UserLocationsStore', () => {
    describe('create', () => {
        it('increments distinctDayCount at most once per calendar day on conflict', () => {
            const { connection, writeStub } = buildMockConnection();
            const store = new UserLocationsStore(connection);

            store.create([{
                userId: 'user-1',
                latitude: 37.7749,
                longitude: -122.4194,
            }]);

            const queryString = writeStub.args[0][0];

            expect(queryString).to.contain('on conflict ("userId", "latitudeRounded", "longitudeRounded") do update set');
            expect(queryString).to.contain(`"visitCount" = "main"."userLocations"."visitCount" + 1`);
            // A second ping on the same day must not inflate the day count
            expect(queryString).to.contain(`"distinctDayCount" = "main"."userLocations"."distinctDayCount" + (CASE WHEN "main"."userLocations"."lastVisitedAt" < date_trunc('day', now()) THEN 1 ELSE 0 END)`);
            expect(queryString).to.contain(`"lastVisitedAt" = now()`);
        });

        it('rounds coordinates to a general location and defaults the counters', () => {
            const { connection, writeStub } = buildMockConnection();
            const store = new UserLocationsStore(connection);

            store.create([{
                userId: 'user-1',
                latitude: 37.77492345,
                longitude: -122.41947654,
            }]);

            const queryString = writeStub.args[0][0];

            expect(queryString).to.contain('37.775');
            expect(queryString).to.contain('-122.419');
        });
    });

    describe('getDwellings', () => {
        it('returns declared homes plus locations seen across enough distinct days recently', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new UserLocationsStore(connection);

            store.getDwellings('user-1');

            const queryString = readStub.args[0][0];

            expect(queryString).to.contain(`from "main"."userLocations" where "userId" = 'user-1'`);
            expect(queryString).to.contain(`"isDeclaredHome" = true`);
            expect(queryString).to.contain(`"distinctDayCount" >= ${Location.DWELL_MIN_DISTINCT_DAYS}`);
            // Stale dwellings (e.g. last year's hotel) are excluded by the recency bound
            expect(queryString).to.contain(`"lastVisitedAt" >=`);
            expect(queryString).to.contain('limit 20');
        });

        it('bounds the recency filter by DWELL_LOCATION_MAX_AGE_MS', () => {
            const clock = sinon.useFakeTimers(new Date('2026-07-28T12:00:00.000Z').getTime());

            try {
                const { connection, readStub } = buildMockConnection();
                const store = new UserLocationsStore(connection);

                store.getDwellings('user-1');

                const expectedCutoff = new Date(Date.now() - Location.DWELL_LOCATION_MAX_AGE_MS).toISOString();

                expect(readStub.args[0][0]).to.contain(expectedCutoff);
            } finally {
                clock.restore();
            }
        });
    });
});
