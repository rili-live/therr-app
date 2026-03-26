/* eslint-disable quotes, max-len */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { expect } from 'chai';
import sinon from 'sinon';
import * as globalConfig from '../../../../global-config';
import sendUnclaimedSpaceEmail from '../../src/api/email/for-business/sendUnclaimedSpaceEmail';
import { awsSES } from '../../src/api/aws';
import Store from '../../src/store';

describe('sendUnclaimedSpaceEmail', () => {
    let sesStub: sinon.SinonStub;

    beforeEach(() => {
        // Stub AWS SES to prevent actual email sending
        sesStub = sinon.stub(awsSES, 'sendEmail').callsFake((_params: any, callback: any) => {
            callback(null, { MessageId: 'test-message-id' });
        });

        // Stub Store methods to prevent DB calls during blacklist check
        sinon.stub(Store.blacklistedEmails, 'get').resolves([]);
        sinon.stub(Store.users, 'getUserByEmail').resolves([]);
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
});
