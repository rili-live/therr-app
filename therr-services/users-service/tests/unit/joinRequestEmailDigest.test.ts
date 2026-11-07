import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import * as sendEmailModule from '../../src/api/email/sendEmail';
import { runJoinRequestEmailPass } from '../../src/handlers/helpers/joinRequestEmailDigest';

describe('open pacts — the join request email pass', () => {
    const NOW = new Date('2026-11-07T14:00:00Z');
    const context = { brandVariation: BrandVariations.HABITS, whiteLabelOrigin: '' };

    const request = (overrides: any = {}) => ({
        requestId: 'req-1',
        pactId: 'pact-1',
        requesterUserName: 'sam',
        habitGoalName: 'Leer',
        creatorUserId: 'creator-1',
        creatorUserName: 'creator',
        creatorFirstName: 'Cam',
        creatorEmail: 'cam@example.com',
        creatorIsUnclaimed: false,
        creatorSettingsEmailReminders: true,
        creatorSettingsLocale: 'es',
        createdAt: new Date('2026-11-05T10:00:00Z'),
        ...overrides,
    });

    let read: sinon.SinonStub;
    let claim: sinon.SinonStub;
    let sendEmail: sinon.SinonStub;

    const stub = ({
        rows = [request()],
        claimed,
        emailFails = false,
    }: any = {}) => {
        read = sinon.stub(Store.pactJoinRequests, 'getUnansweredForEmailReminder').resolves(rows);
        claim = sinon.stub(Store.pactJoinRequests, 'claimEmailReminders')
            .callsFake(async (ids: string[]) => (claimed ? ids.filter((id) => claimed.includes(id)) : ids));
        sendEmail = emailFails
            ? sinon.stub(sendEmailModule, 'default').rejects(new Error('SES down'))
            : sinon.stub(sendEmailModule, 'default').resolves({} as any);
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_JOIN_REQUEST_EMAILS_ENABLED;
    });

    it('reads pending requests 1 to 7 days old, on pacts that can still take the requester', async () => {
        stub({ rows: [] });
        await runJoinRequestEmailPass(context, NOW);

        const [before, after, statuses] = read.firstCall.args;
        expect(before.toISOString()).to.equal('2026-11-06T14:00:00.000Z');
        expect(after.toISOString()).to.equal('2026-10-31T14:00:00.000Z');
        expect(statuses).to.deep.equal(['pending', 'active']);
    });

    it('emails the creator once, in their own locale, after claiming the request', async () => {
        stub();
        const counters = await runJoinRequestEmailPass(context, NOW);

        expect(counters).to.include({ requestsEvaluated: 1, creatorsEmailed: 1, requestsEmailed: 1 });
        expect(claim.calledOnceWith(['req-1'])).to.equal(true);
        expect(claim.calledBefore(sendEmail)).to.equal(true);
        const [emailConfig, htmlConfig] = sendEmail.firstCall.args;
        expect(emailConfig).to.include({ locale: 'es' });
        expect(emailConfig.toAddresses).to.deep.equal(['cam@example.com']);
        expect(emailConfig.subject).to.equal('sam pidió unirse a tu pacto de Leer');
        expect(htmlConfig.body1).to.contain('sam');
    });

    it('rolls several requests to one creator into a single email', async () => {
        stub({
            rows: [
                request(),
                request({ requestId: 'req-2', pactId: 'pact-2', requesterUserName: 'alex', habitGoalName: 'Run' }),
            ],
        });
        const counters = await runJoinRequestEmailPass(context, NOW);

        expect(counters).to.include({ creatorsEmailed: 1, requestsEmailed: 2 });
        expect(sendEmail.calledOnce).to.equal(true);
        const [emailConfig, htmlConfig] = sendEmail.firstCall.args;
        expect(emailConfig.subject).to.equal('2 personas pidieron unirse a tus pactos');
        expect(htmlConfig.body1).to.contain('sam (Leer), alex (Run)');
    });

    it('sends one email per creator when requests are waiting on different people', async () => {
        stub({
            rows: [
                request(),
                request({ requestId: 'req-2', creatorUserId: 'creator-2', creatorEmail: 'dee@example.com' }),
            ],
        });
        const counters = await runJoinRequestEmailPass(context, NOW);

        expect(counters.creatorsEmailed).to.equal(2);
        expect(sendEmail.secondCall.args[0].toAddresses).to.deep.equal(['dee@example.com']);
    });

    it('leaves a creator who turned email reminders off, or has no email, unclaimed and unsent', async () => {
        stub({
            rows: [
                request({ creatorSettingsEmailReminders: false }),
                request({ requestId: 'req-2', creatorUserId: 'creator-2', creatorEmail: null }),
                request({ requestId: 'req-3', creatorUserId: 'creator-3', creatorIsUnclaimed: true }),
            ],
        });
        const counters = await runJoinRequestEmailPass(context, NOW);

        expect(counters.requestsNoChannel).to.equal(3);
        expect(claim.called).to.equal(false);
        expect(sendEmail.called).to.equal(false);
    });

    it('emails only about the requests it claimed, and nothing when an overlapping run took them all', async () => {
        stub({
            rows: [request(), request({ requestId: 'req-2', requesterUserName: 'alex' })],
            claimed: ['req-2'],
        });
        let counters = await runJoinRequestEmailPass(context, NOW);
        expect(counters).to.include({ requestsDeduped: 1, requestsEmailed: 1 });
        expect(sendEmail.firstCall.args[0].subject).to.contain('alex');

        sinon.restore();
        stub({ claimed: [] });
        counters = await runJoinRequestEmailPass(context, NOW);
        expect(counters.requestsDeduped).to.equal(1);
        expect(sendEmail.called).to.equal(false);
    });

    it('counts a failed send and carries on with the next creator', async () => {
        stub({
            rows: [request(), request({ requestId: 'req-2', creatorUserId: 'creator-2' })],
            emailFails: true,
        });
        const counters = await runJoinRequestEmailPass(context, NOW);

        expect(counters.emailErrors).to.equal(2);
        expect(claim.calledTwice).to.equal(true);
    });

    it('does nothing at all when switched off', async () => {
        process.env.HABIT_JOIN_REQUEST_EMAILS_ENABLED = 'false';
        stub();
        const counters = await runJoinRequestEmailPass(context, NOW);

        expect(counters.requestsEvaluated).to.equal(0);
        expect(read.called).to.equal(false);
    });
});
