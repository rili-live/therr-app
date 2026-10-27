/**
 * Regression guard for brand leakage in the connection-request email.
 *
 * The button read "Open Friends with Habits" but linked to the global host (therr.com), whose
 * app links open the Therr app, so a habits user tapping it landed in the wrong app.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import sendPendingInviteEmail from '../../src/api/email/for-social/retention/sendPendingInviteEmail';
import { awsSES } from '../../src/api/aws';
import * as globalConfig from '../../../../global-config';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

describe('sendPendingInviteEmail', () => {
    let sesStub: sinon.SinonStub;

    beforeEach(() => {
        sesStub = sinon.stub(awsSES, 'sendEmail').resolves({ MessageId: 'test-message-id' });
    });

    afterEach(() => {
        sinon.restore();
    });

    const send = (brandVariation: string) => sendPendingInviteEmail({
        locale: 'en-us',
        subject: 'janedoe wants to connect',
        toAddresses: ['invitee@example.com'],
        agencyDomainName: '',
        brandVariation,
        recipientIdentifiers: {
            id: 'recipient-id',
            accountEmail: 'invitee@example.com',
            settingsEmailInvites: true,
        },
    }, {
        fromName: 'janedoe',
    });

    const sentHtml = () => sesStub.args[0][0].Content.Simple.Body.Html.Data;

    it('links a niche brand\'s button to its own subdomain', async () => {
        await send('habits');

        expect(sentHtml()).to.contain('Open Friends with Habits');
        expect(sentHtml()).to.contain('href="https://habits.therr.com"');
        expect(sentHtml()).to.not.contain(`href="${globalConfig[process.env.NODE_ENV].hostFull}"`);
    });

    it('leaves Therr on the global host', async () => {
        await send('therr');

        expect(sentHtml()).to.contain(`href="${globalConfig[process.env.NODE_ENV].hostFull}"`);
        expect(sentHtml()).to.not.contain('habits.therr.com');
    });
});
