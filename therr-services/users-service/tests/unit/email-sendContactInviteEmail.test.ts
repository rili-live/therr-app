/**
 * Regression guard for brand leakage in the contact-invite flow.
 *
 * Three things used to be hard-coded to Therr no matter which app sent the invite:
 *   - the email subject, which was built by the caller as a literal English
 *     "<name> invited you to Therr app" — wrong brand *and* untranslated;
 *   - the magic-link host, taken from the global config rather than the brand's own
 *     `appHostFull`, so a Friends with Habits invite bounced the recipient to therr.com
 *     even though `habitsSubdomainRoutes` exists to serve `/invite/link/:token` on the
 *     habits subdomain;
 *   - the SMS body (covered by ./invites-phone-copy.test.ts).
 */
import { expect } from 'chai';
import sinon from 'sinon';
import sendContactInviteEmail from '../../src/api/email/for-social/sendContactInviteEmail';
import { awsSES } from '../../src/api/aws';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

describe('sendContactInviteEmail', () => {
    let sesStub: sinon.SinonStub;

    beforeEach(() => {
        sesStub = sinon.stub(awsSES, 'sendEmail').resolves({ MessageId: 'test-message-id' });
    });

    afterEach(() => {
        sinon.restore();
    });

    const templateParams = {
        fromName: 'Jane Doe',
        fromEmail: 'jane@example.com',
        toEmail: 'invitee@example.com',
        inviteToken: '2a8f9c1e-7b3d-4a2e-9f11-6c5d4e3b2a10',
    };

    const send = (brandVariation: string, locale = 'en-us') => sendContactInviteEmail({
        locale,
        toAddresses: [templateParams.toEmail],
        agencyDomainName: '',
        brandVariation,
    }, templateParams);

    const sentSubject = () => sesStub.args[0][0].Content.Simple.Subject.Data;
    const sentHtml = () => sesStub.args[0][0].Content.Simple.Body.Html.Data;

    describe('subject', () => {
        it('names the sending brand, not Therr', async () => {
            await send('habits');

            expect(sentSubject()).to.contain('Friends with Habits');
            expect(sentSubject()).to.contain('Jane Doe');
            expect(sentSubject()).to.not.contain('Therr');
        });

        it('still reads correctly for Therr', async () => {
            await send('therr');

            expect(sentSubject()).to.contain('Therr');
            expect(sentSubject()).to.contain('Jane Doe');
        });

        it('is translated rather than always English', async () => {
            await send('therr', 'es');

            // "te invitó a" — the Spanish dictionary entry, not the old English literal.
            expect(sentSubject()).to.contain('te invitó a');
            expect(sentSubject()).to.not.contain('invited you to');
        });

        it('leaves no unsubstituted placeholders', async () => {
            await send('habits');

            expect(sentSubject()).to.not.contain('{');
            expect(sentSubject()).to.not.contain('}');
        });
    });

    describe('magic link host', () => {
        it('points a niche brand at its own subdomain', async () => {
            await send('habits');

            expect(sentHtml()).to.contain(`https://habits.therr.com/invite/link/${templateParams.inviteToken}`);
        });

        it('leaves Therr on the global host', async () => {
            await send('therr');

            expect(sentHtml()).to.contain(`/invite/link/${templateParams.inviteToken}`);
            expect(sentHtml()).to.not.contain('habits.therr.com');
            // Guards the fallback: `parentHomepageUrl` for Therr is the marketing site,
            // which does not serve this route.
            expect(sentHtml()).to.not.contain('therr.app/invite/link');
        });
    });
});
