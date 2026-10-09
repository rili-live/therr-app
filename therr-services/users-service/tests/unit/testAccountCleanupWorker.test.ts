/**
 * Test account cleanup worker — the decisions that, if wrong, delete the wrong thing.
 *
 * The worker deletes content in three services on a timer, driven by an email list in an env
 * var. What must hold:
 *
 *   - with TEST_ACCOUNT_CLEANUP_ENABLED off it only HIDES (the cutoff sent is the epoch);
 *   - with it on, only content older than the retention window goes, never what a reviewer
 *     posted moments ago;
 *   - the super admin (which owns every reassigned space and forum) is never touched even if
 *     its email is configured by mistake;
 *   - every downstream call carries TEST_ACCOUNT, which the other services require before they
 *     delete anything;
 *   - one unreachable service does not stop the rest.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels } from 'therr-js-utilities/constants';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import { SUPER_ADMIN_ID } from '../../src/constants';
import {
    getTestAccountCleanupConfig,
    runTestAccountCleanup,
} from '../../src/utilities/testAccountCleanupWorker';

const TEST_USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', userName: 'playreviewer', accessLevels: [AccessLevels.TEST_ACCOUNT] };
const NOW = new Date('2026-10-08T12:00:00.000Z');

describe('testAccountCleanupWorker', () => {
    let grant: sinon.SinonStub;
    let getTestAccounts: sinon.SinonStub;
    let purgeThoughts: sinon.SinonStub;
    let internalRestRequest: sinon.SinonStub;

    beforeEach(() => {
        grant = sinon.stub(Store.users, 'grantTestAccountAccess').resolves([]);
        getTestAccounts = sinon.stub(Store.users, 'getTestAccounts').resolves([TEST_USER]);
        purgeThoughts = sinon.stub(Store.thoughts, 'purgeTestAccountContent').resolves({ hidden: 1, deleted: 0 });
        internalRestRequest = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ data: {} } as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getTestAccountCleanupConfig', () => {
        it('parses the email list and defaults to hide-only with a 48h window', () => {
            const config = getTestAccountCleanupConfig({ TEST_ACCOUNT_EMAILS: ' Rili.Main@gmail.com, ,qa@example.com ' });
            expect(config.emails).to.deep.equal(['rili.main@gmail.com', 'qa@example.com']);
            expect(config.isPurgeEnabled).to.equal(false);
            expect(config.retentionHours).to.equal(48);
        });

        it('only enables purging on an exact "true" and floors the window at one hour', () => {
            expect(getTestAccountCleanupConfig({ TEST_ACCOUNT_CLEANUP_ENABLED: '1' }).isPurgeEnabled).to.equal(false);
            expect(getTestAccountCleanupConfig({ TEST_ACCOUNT_CLEANUP_ENABLED: 'true' }).isPurgeEnabled).to.equal(true);
            expect(getTestAccountCleanupConfig({ TEST_ACCOUNT_CONTENT_RETENTION_HOURS: '0' }).retentionHours).to.equal(48);
            expect(getTestAccountCleanupConfig({ TEST_ACCOUNT_CONTENT_RETENTION_HOURS: '12' }).retentionHours).to.equal(12);
        });
    });

    it('flags the configured emails before listing accounts', async () => {
        await runTestAccountCleanup({ emails: ['rili.main@gmail.com'], isPurgeEnabled: false, retentionHours: 48 }, NOW);
        expect(grant.calledOnceWithExactly(['rili.main@gmail.com'])).to.equal(true);
        expect(grant.calledBefore(getTestAccounts)).to.equal(true);
    });

    it('only hides when purging is disabled', async () => {
        await runTestAccountCleanup({ emails: [], isPurgeEnabled: false, retentionHours: 48 }, NOW);

        expect(purgeThoughts.firstCall.args[1].getTime()).to.equal(0);
        expect(internalRestRequest.callCount).to.equal(2);
        internalRestRequest.getCalls().forEach((call) => {
            expect(call.args[1].data.createdBefore).to.equal(new Date(0).toISOString());
        });
    });

    it('deletes only past the retention window, with TEST_ACCOUNT on every downstream call', async () => {
        const result = await runTestAccountCleanup({ emails: [], isPurgeEnabled: true, retentionHours: 48 }, NOW);
        const expectedCutoff = new Date('2026-10-06T12:00:00.000Z');

        expect(purgeThoughts.firstCall.args).to.deep.equal([TEST_USER.id, expectedCutoff]);
        internalRestRequest.getCalls().forEach((call) => {
            const [{ headers }, axiosConfig] = call.args;
            expect(axiosConfig.method).to.equal('delete');
            expect(axiosConfig.url).to.match(/\/test-account-content$/);
            expect(axiosConfig.data.createdBefore).to.equal(expectedCutoff.toISOString());
            expect(headers['x-userid']).to.equal(TEST_USER.id);
            expect(JSON.parse(headers['x-user-access-levels'])).to.include(AccessLevels.TEST_ACCOUNT);
        });
        expect(result).to.deep.equal({
            flagged: 0, accounts: 1, skipped: 0, failures: 0,
        });
    });

    it('never touches the super admin, even when it carries the flag', async () => {
        getTestAccounts.resolves([
            { id: SUPER_ADMIN_ID, userName: 'admin', accessLevels: [AccessLevels.TEST_ACCOUNT] },
            { id: 'bbbbbbbb-0000-4000-8000-000000000002', userName: 'staff', accessLevels: [AccessLevels.TEST_ACCOUNT, AccessLevels.SUPER_ADMIN] },
        ]);

        const result = await runTestAccountCleanup({ emails: [], isPurgeEnabled: true, retentionHours: 48 }, NOW);

        expect(purgeThoughts.called).to.equal(false);
        expect(internalRestRequest.called).to.equal(false);
        expect(result.skipped).to.equal(2);
    });

    it('keeps going when one service fails, and counts the failure', async () => {
        internalRestRequest.onFirstCall().rejects(new Error('maps-service unreachable'));

        const result = await runTestAccountCleanup({ emails: [], isPurgeEnabled: true, retentionHours: 48 }, NOW);

        expect(purgeThoughts.calledOnce).to.equal(true);
        expect(internalRestRequest.callCount).to.equal(2);
        expect(result.failures).to.equal(1);
    });
});
