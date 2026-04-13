/**
 * E2E test suite: Cross-flow smoke test
 *
 * Hit-every-table run that catches catastrophic "everything broken" states
 * before the individual flow suites run. If this file skips or errors, the
 * infra is not ready and subsequent tests will be skipped.
 */
import { expect } from 'chai';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import { queryUsersDb, queryMapsDb } from '../helpers/fixtures';

describe('Campaign E2E - Infrastructure Smoke', () => {
    let skipTests = false;

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping.');
            console.log('   Start infra: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run users migrations and maps migrations before retrying.\n');
            skipTests = true;
        }
    });

    after(async () => {
        await closeE2eConnection();
    });

    it('can read from main.users table', async () => {
        if (skipTests) return;
        const rows = await queryUsersDb('SELECT 1 as ok FROM "main"."users" LIMIT 1');
        // 0 rows is fine; the point is the query ran.
        expect(rows).to.be.an('array');
    });

    it('can read from main.spaces table', async () => {
        if (skipTests) return;
        const rows = await queryMapsDb('SELECT 1 as ok FROM "main"."spaces" LIMIT 1');
        expect(rows).to.be.an('array');
    });

    it('can read from main.moments table', async () => {
        if (skipTests) return;
        const rows = await queryMapsDb('SELECT 1 as ok FROM "main"."moments" LIMIT 1');
        expect(rows).to.be.an('array');
    });

    it('can read from main.events table', async () => {
        if (skipTests) return;
        const rows = await queryMapsDb('SELECT 1 as ok FROM "main"."events" LIMIT 1');
        expect(rows).to.be.an('array');
    });

    it('has PostGIS available for geospatial queries', async () => {
        if (skipTests) return;
        const rows = await queryMapsDb("SELECT ST_AsText(ST_SetSRID(ST_MakePoint(-86.1581, 39.7684), 4326)) as pt");
        expect(rows[0].pt).to.be.a('string');
    });

    it('can read from main.spaceIncentives and main.spaceIncentiveCoupons', async () => {
        if (skipTests) return;
        const incentives = await queryMapsDb('SELECT 1 as ok FROM "main"."spaceIncentives" LIMIT 1');
        const coupons = await queryMapsDb('SELECT 1 as ok FROM "main"."spaceIncentiveCoupons" LIMIT 1');
        expect(incentives).to.be.an('array');
        expect(coupons).to.be.an('array');
    });

    it('can read from main.userAchievements', async () => {
        if (skipTests) return;
        const rows = await queryUsersDb('SELECT 1 as ok FROM "main"."userAchievements" LIMIT 1');
        expect(rows).to.be.an('array');
    });
});
