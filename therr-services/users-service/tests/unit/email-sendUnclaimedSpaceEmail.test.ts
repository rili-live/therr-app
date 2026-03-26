/* eslint-disable quotes, max-len */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { expect } from 'chai';
import sinon from 'sinon';
import sendUnclaimedSpaceEmail, { hasAlreadySentEmail } from '../../src/api/email/for-business/sendUnclaimedSpaceEmail';
import { awsSES } from '../../src/api/aws';
import Store from '../../src/store';

describe('sendUnclaimedSpaceEmail', () => {
    let sesStub: sinon.SinonStub;
    let metricsGetStub: sinon.SinonStub;
    let metricsCreateStub: sinon.SinonStub;

    beforeEach(() => {
        // Stub AWS SES to prevent actual email sending
        sesStub = sinon.stub(awsSES, 'sendEmail').callsFake((_params: any, callback: any) => {
            callback(null, { MessageId: 'test-message-id' });
        });

        // Stub Store methods to prevent DB calls during blacklist check
        sinon.stub(Store.blacklistedEmails, 'get').resolves([]);
        sinon.stub(Store.users, 'getUserByEmail').resolves([]);

        // Stub userMetrics for tracking
        metricsGetStub = sinon.stub(Store.userMetrics, 'get').resolves([]);
        metricsCreateStub = sinon.stub(Store.userMetrics, 'create').resolves([{ id: 'metric-1' }]);
    });

    afterEach(() => {
        sinon.restore();
    });

    const baseEmailParams = {
        subject: '',
        toAddresses: ['business@example.com'],
        agencyDomainName: 'therr.com',
        brandVariation: 'therr',
        locale: 'en-us',
    };

    const baseTemplateParams = {
        spaceName: 'Test Coffee Shop',
        spaceId: 'space-123',
    };

    it('calls sendEmail with the correct buttonHref containing spaceId', async () => {
        await sendUnclaimedSpaceEmail(baseEmailParams, baseTemplateParams);

        expect(sesStub.calledOnce).to.be.true;
        const params = sesStub.args[0][0];
        const htmlBody = params.Content.Simple.Body.Html.Data;
        expect(htmlBody).to.include('/spaces/space-123');
        expect(htmlBody).to.include('claim');
    });

    it('uses translated subject as fallback when subject is empty', async () => {
        await sendUnclaimedSpaceEmail({ ...baseEmailParams, subject: '' }, baseTemplateParams);

        expect(sesStub.calledOnce).to.be.true;
        const params = sesStub.args[0][0];
        const subject = params.Content.Simple.Subject.Data;
        expect(subject).to.be.a('string');
        expect(subject.length).to.be.greaterThan(0);
        expect(subject).to.include('Test Coffee Shop');
    });

    it('uses provided subject when explicitly set', async () => {
        await sendUnclaimedSpaceEmail({ ...baseEmailParams, subject: 'Custom Subject' }, baseTemplateParams);

        expect(sesStub.calledOnce).to.be.true;
        const params = sesStub.args[0][0];
        expect(params.Content.Simple.Subject.Data).to.equal('Custom Subject');
    });

    it('does not include missing fields text when missingFields is not provided', async () => {
        await sendUnclaimedSpaceEmail(baseEmailParams, baseTemplateParams);

        expect(sesStub.calledOnce).to.be.true;
        const htmlBody = sesStub.args[0][0].Content.Simple.Body.Html.Data;
        expect(htmlBody).to.not.include('missing some key details');
    });

    it('includes missing field labels in email body when missingFields is provided', async () => {
        await sendUnclaimedSpaceEmail(baseEmailParams, {
            ...baseTemplateParams,
            missingFields: ['openingHours', 'phoneNumber'],
        });

        expect(sesStub.calledOnce).to.be.true;
        const htmlBody = sesStub.args[0][0].Content.Simple.Body.Html.Data;
        expect(htmlBody).to.include('business hours');
        expect(htmlBody).to.include('phone number');
    });

    it('sends to the correct recipient address', async () => {
        await sendUnclaimedSpaceEmail(baseEmailParams, baseTemplateParams);

        expect(sesStub.calledOnce).to.be.true;
        const params = sesStub.args[0][0];
        expect(params.Destination.ToAddresses).to.deep.equal(['business@example.com']);
    });

    it('includes spaceName in the email body', async () => {
        await sendUnclaimedSpaceEmail(baseEmailParams, baseTemplateParams);

        expect(sesStub.calledOnce).to.be.true;
        const htmlBody = sesStub.args[0][0].Content.Simple.Body.Html.Data;
        expect(htmlBody).to.include('Test Coffee Shop');
    });

    describe('email tracking', () => {
        it('logs a metric after sending the email', async () => {
            await sendUnclaimedSpaceEmail(baseEmailParams, baseTemplateParams);

            expect(metricsCreateStub.calledOnce).to.be.true;
            const createArgs = metricsCreateStub.args[0][0];
            expect(createArgs.name).to.equal('space.marketing.unclaimedEmailSent');
            expect(createArgs.value).to.equal('1');
            const dims = JSON.parse(createArgs.dimensions);
            expect(dims.spaceId).to.equal('space-123');
            expect(dims.businessEmail).to.equal('business@example.com');
        });

        it('skips sending and returns alreadySent if email was previously sent for this space', async () => {
            metricsGetStub.resolves([{
                dimensions: JSON.stringify({ spaceId: 'space-123', businessEmail: 'business@example.com' }),
            }]);

            const result = await sendUnclaimedSpaceEmail(baseEmailParams, baseTemplateParams);

            expect(result).to.deep.equal({ alreadySent: true });
            expect(sesStub.called).to.be.false;
            expect(metricsCreateStub.called).to.be.false;
        });

        it('sends email when metrics exist but for a different spaceId', async () => {
            metricsGetStub.resolves([{
                dimensions: JSON.stringify({ spaceId: 'other-space', businessEmail: 'other@example.com' }),
            }]);

            await sendUnclaimedSpaceEmail(baseEmailParams, baseTemplateParams);

            expect(sesStub.calledOnce).to.be.true;
            expect(metricsCreateStub.calledOnce).to.be.true;
        });
    });

    describe('hasAlreadySentEmail', () => {
        it('returns false when no metrics exist', async () => {
            metricsGetStub.resolves([]);
            const result = await hasAlreadySentEmail('space-123');
            expect(result).to.be.false;
        });

        it('returns true when a matching metric exists', async () => {
            metricsGetStub.resolves([{
                dimensions: JSON.stringify({ spaceId: 'space-123' }),
            }]);
            const result = await hasAlreadySentEmail('space-123');
            expect(result).to.be.true;
        });

        it('returns false when metrics exist but for different spaces', async () => {
            metricsGetStub.resolves([{
                dimensions: JSON.stringify({ spaceId: 'other-space' }),
            }]);
            const result = await hasAlreadySentEmail('space-123');
            expect(result).to.be.false;
        });

        it('returns false when the metrics query fails', async () => {
            metricsGetStub.rejects(new Error('DB error'));
            const result = await hasAlreadySentEmail('space-123');
            expect(result).to.be.false;
        });
    });
});
