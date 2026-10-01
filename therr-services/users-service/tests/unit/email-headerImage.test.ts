/**
 * Regression guard for the email header image.
 *
 * `hostContext` has declared a per-brand `headerImageRelativePath` for a long time, but
 * sendEmail never passed it to the template, so every brand — Friends with Habits
 * included — rendered Therr's `email-header.jpg` beneath its own logo.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import sendEmail, { ISendEmailHtmlConfig } from '../../src/api/email/sendEmail';
import hostContext from '../../src/constants/hostContext';
import { awsSES } from '../../src/api/aws';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const webStaticDir = path.join(__dirname, '../../../../therr-client-web/src/_static');

describe('sendEmail header image', () => {
    let sesStub: sinon.SinonStub;

    beforeEach(() => {
        sesStub = sinon.stub(awsSES, 'sendEmail').resolves({ MessageId: 'test-message-id' });
    });

    afterEach(() => {
        sinon.restore();
    });

    const send = (brandVariation: string, htmlConfig: Partial<ISendEmailHtmlConfig> = {}) => sendEmail({
        subject: 'Subject',
        toAddresses: ['someone@example.com'],
        agencyDomainName: '',
        brandVariation,
    }, {
        header: 'Header',
        body1: 'Body',
        ...htmlConfig,
    });

    const sentHtml = () => sesStub.args[0][0].Content.Simple.Body.Html.Data;

    it('renders the Friends with Habits header, not the Therr one', async () => {
        await send('habits');

        expect(sentHtml()).to.contain('/assets/images/habits-email-header.jpg');
        expect(sentHtml()).to.not.contain('/assets/images/email-header.jpg');
    });

    it('renders the brand variant header when the email asks for one', async () => {
        await send('habits', { headerImageVariant: 'social' });

        expect(sentHtml()).to.contain('/assets/images/habits-email-header-friends.jpg');
    });

    it('lets an explicit header path win over the variant', async () => {
        await send('habits', { headerImageVariant: 'social', headerImageRelativePath: 'assets/images/custom.jpg' });

        expect(sentHtml()).to.contain('/assets/images/custom.jpg');
        expect(sentHtml()).to.not.contain('habits-email-header-friends.jpg');
    });

    it('keeps the default Therr header for Therr, even when a variant is requested', async () => {
        await send('therr', { headerImageVariant: 'progress' });

        expect(sentHtml()).to.contain('/assets/images/email-header.jpg');
    });

    it('only references header images that exist in therr-client-web static assets', function test() {
        if (!fs.existsSync(webStaticDir)) {
            // The service is also built and tested in a container that only copies
            // therr-services/users-service — skip rather than fail on a missing peer package.
            // `this.skip()` throws, so nothing below runs.
            this.skip();
        }

        Object.values(hostContext).forEach(({ emailTemplates }) => {
            [emailTemplates.headerImageRelativePath, ...Object.values(emailTemplates.headerImageVariants || {})]
                .filter(Boolean)
                .forEach((relativePath) => {
                    expect(fs.existsSync(path.join(webStaticDir, relativePath as string)), relativePath).to.equal(true);
                });
        });
    });
});
