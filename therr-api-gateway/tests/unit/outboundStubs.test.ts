/**
 * Guards the test-suite safety net itself.
 *
 * `tests/setup.ts` neuters Twilio by patching `Twilio.prototype.request`, the
 * one method every resource call funnels through. That choke point is an
 * implementation detail of the SDK: a major `twilio` upgrade could move it,
 * and nothing else in the suite would notice — tests would keep passing while
 * quietly billing and delivering real SMS from developer machines and CI.
 *
 * This asserts the patch is still in the path.
 */
import { expect } from 'chai';
import twilio from 'twilio';
import { resetSmsOutbox, smsOutbox } from '../helpers/outboundStubs';

describe('outbound transport stubs (test safety net)', () => {
    beforeEach(() => {
        resetSmsOutbox();
    });

    it('captures a Twilio send instead of putting it on the wire', async () => {
        const client = new twilio.Twilio(`AC${'0'.repeat(32)}`, 'test-auth-token');

        const message = await client.messages.create({
            body: 'verification code 123456',
            to: '+13175551234',
            from: '+15551234567',
        });

        expect(smsOutbox).to.have.lengthOf(1);
        expect(smsOutbox[0].to).to.equal('+13175551234');
        expect(smsOutbox[0].from).to.equal('+15551234567');
        expect(smsOutbox[0].body).to.equal('verification code 123456');
        // The stub must still resolve to something message-shaped, or callers
        // that read the returned sid would break only under test.
        expect(message.sid).to.be.a('string');
    });
});
