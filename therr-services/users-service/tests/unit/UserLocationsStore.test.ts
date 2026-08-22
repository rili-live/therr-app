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
    /**
     * "Where does this user live?", for seeding a feed with local content.
     *
     * Deliberately a different question from getDwellings below, which gates on either an
     * explicit declaration or several days of history. A user who signed up an hour ago has
     * neither, and they are exactly who this is for.
     */
    describe('getPrimary', () => {
        it('accepts a first ping, so a brand-new account is not excluded', () => {
            const { connection, readStub } = buildMockConnection();
            new UserLocationsStore(connection).getPrimary('user-1');

            const queryString = readStub.args[0][0];
            // No distinctDayCount threshold: requiring one would mean a new user waits
            // DWELL_MIN_DISTINCT_DAYS before their own city can appear in their feed.
            expect(queryString).to.not.contain('distinctDayCount" >=');
            expect(queryString).to.contain('"userId" = \'user-1\'');
            expect(queryString).to.contain('limit 1');
        });

        it('ignores a stale location unless the user declared it home', () => {
            const { connection, readStub } = buildMockConnection();
            new UserLocationsStore(connection).getPrimary('user-1');

            const queryString = readStub.args[0][0];
            // Otherwise a ping from a city they left years ago keeps shaping their feed.
            expect(queryString).to.contain('"isDeclaredHome" = true');
            expect(queryString).to.contain('"lastVisitedAt" >=');
        });

        it('prefers a declared home, then an established dwelling, over a one-off ping', () => {
            const { connection, readStub } = buildMockConnection();
            new UserLocationsStore(connection).getPrimary('user-1');

            const queryString = readStub.args[0][0];
            expect(queryString).to.contain('order by "isDeclaredHome" desc, "distinctDayCount" desc, "visitCount" desc, "lastVisitedAt" desc');
        });

        it('never returns a row with a missing coordinate', () => {
            const { connection, readStub } = buildMockConnection();
            new UserLocationsStore(connection).getPrimary('user-1');

            const queryString = readStub.args[0][0];
            // Both columns are nullable, and a half-written row is useless to every caller.
            expect(queryString).to.contain('"latitude" is not null');
            expect(queryString).to.contain('"longitude" is not null');
        });
    });

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
            expect(queryString).to.contain(`"distinctDayCount" = "main"."userLocations"."distinctDayCount" + (CASE WHEN ("main"."userLocations"."lastVisitedAt" AT TIME ZONE 'UTC')::date < (now() AT TIME ZONE 'UTC')::date THEN 1 ELSE 0 END)`);
            expect(queryString).to.contain(`"lastVisitedAt" = now()`);
        });

        it('anchors the day boundary to UTC rather than the database session timezone', () => {
            const { connection, writeStub } = buildMockConnection();
            const store = new UserLocationsStore(connection);

            store.create([{
                userId: 'user-1',
                latitude: 37.7749,
                longitude: -122.4194,
            }]);

            const queryString = writeStub.args[0][0];

            // A bare date_trunc('day', now()) resolves against the session's TimeZone, so the
            // day boundary would drift between the app pool, psql, and a read replica.
            expect(queryString).to.not.contain(`date_trunc('day', now())`);
            expect(queryString).to.contain(`(now() AT TIME ZONE 'UTC')::date`);
            expect(queryString).to.contain(`("main"."userLocations"."lastVisitedAt" AT TIME ZONE 'UTC')::date`);
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
