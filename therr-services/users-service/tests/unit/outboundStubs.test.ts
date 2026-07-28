/**
 * Guards the test-suite safety net itself.
 *
 * `tests/setup.ts` neuters the three outbound transports by patching
 * `SESv2.prototype.send`, `Twilio.prototype.request`, and
 * `StripeResource.prototype._makeRequest` — the single methods every SES
 * command, every Twilio resource call, and every Stripe resource call funnel
 * through. Those choke points are implementation details of each SDK: a major
 * version bump could move them, and nothing else in the suite would notice.
 * Tests would keep passing while quietly mailing real addresses, billing real
 * SMS, and reading/mutating a live Stripe account from developer machines
 * (where `tests/setup.ts` loads live credentials out of the root `.env`) and
 * from CI.
 *
 * Each assertion drives the *production* client — the singletons under
 * `src/api/` that handlers actually use — rather than a locally constructed
 * one. A stub that only intercepts a throwaway client would prove nothing
 * about the path real code takes, and would miss a regression in the lazy-init
 * proxy in `src/api/twilio.ts`.
 */
import { expect } from 'chai';
import { awsSES } from '../../src/api/aws';
import twilioClient from '../../src/api/twilio';
import stripe from '../../src/api/stripe';
import {
    emailOutbox, resetOutboxes, smsOutbox, stripeAttempts,
} from '../helpers/outboundStubs';

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

    it('captures a Twilio send from the production client instead of putting it on the wire', async () => {
        const message = await twilioClient.messages.create({
            body: 'PACT-ABCD',
            to: '+13175550123',
            from: '+15551234567',
        });

        expect(smsOutbox).to.have.lengthOf(1);
        expect(smsOutbox[0].to).to.equal('+13175550123');
        expect(smsOutbox[0].from).to.equal('+15551234567');
        expect(smsOutbox[0].body).to.equal('PACT-ABCD');
        // The stub must still resolve to something message-shaped, or callers
        // that read the returned sid would break only under test.
        expect(message.sid).to.be.a('string');
    });

    it('blocks a live Stripe call from the production client and names the endpoint', async () => {
        let caught: Error | undefined;
        try {
            await stripe.customers.retrieve('cus_test_123');
        } catch (err: any) {
            caught = err;
        }

        // Rejecting rather than faking is deliberate: a Stripe call that
        // reaches this point is a missing stub, and a plausible fake response
        // would let the test pass against invented data.
        expect(caught, 'expected the Stripe call to be blocked, not to succeed').to.be.an('error');
        expect(caught?.message).to.contain('Blocked a live Stripe API call');
        expect(caught?.message).to.contain('/v1/customers/{customer}');

        expect(stripeAttempts).to.have.lengthOf(1);
        expect(stripeAttempts[0].method).to.equal('GET');
        expect(stripeAttempts[0].path).to.equal('/v1/customers/{customer}');
    });
});
