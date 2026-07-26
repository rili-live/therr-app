/**
 * Guards the test-suite safety net itself.
 *
 * `tests/setup.ts` neuters the two outbound transports by patching
 * `SESv2.prototype.send` and `Twilio.prototype.request` — the single methods
 * every SES command and every Twilio resource call funnel through. Those choke
 * points are implementation details of each SDK: a major version bump could
 * move them, and nothing else in the suite would notice. Tests would keep
 * passing while quietly mailing real addresses and billing real SMS from
 * developer machines (where `tests/setup.ts` loads live credentials out of the
 * root `.env`) and from CI.
 *
 * This asserts both patches are still in the path.
 */
import { expect } from 'chai';
import twilio from 'twilio';
import { awsSES } from '../../src/api/aws';
import { emailOutbox, resetOutboxes, smsOutbox } from '../helpers/outboundStubs';

describe('outbound transport stubs (test safety net)', () => {
    beforeEach(() => {
        resetOutboxes();
    });

    it('captures an SES send instead of putting it on the wire', async () => {
        const result: any = await awsSES.sendEmail({
            Destination: { ToAddresses: ['recipient@example.com'] },
            FromEmailAddress: '"Therr" <noreply@therr.com>',
            Content: {
                Simple: {
                    Subject: { Data: 'Test subject' },
                    Body: { Html: { Data: '<p>Test body</p>' } },
                },
            },
        });

        expect(emailOutbox).to.have.lengthOf(1);
        expect(emailOutbox[0].toAddresses).to.deep.equal(['recipient@example.com']);
        expect(emailOutbox[0].subject).to.equal('Test subject');
        expect(emailOutbox[0].html).to.equal('<p>Test body</p>');
        expect(result.MessageId).to.be.a('string');
    });

    it('captures a Twilio send instead of putting it on the wire', async () => {
        const client = new twilio.Twilio(`AC${'0'.repeat(32)}`, 'test-auth-token');

        const message = await client.messages.create({
            body: 'PACT-ABCD',
            to: '+13175551234',
            from: '+15551234567',
        });

        expect(smsOutbox).to.have.lengthOf(1);
        expect(smsOutbox[0].to).to.equal('+13175551234');
        expect(smsOutbox[0].from).to.equal('+15551234567');
        expect(smsOutbox[0].body).to.equal('PACT-ABCD');
        // The stub must still resolve to something message-shaped, or callers
        // that read the returned sid would break only under test.
        expect(message.sid).to.be.a('string');
    });
});
