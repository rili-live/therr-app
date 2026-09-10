/**
 * Guards the test-suite safety net itself.
 *
 * `tests/setup.ts` neuters Twilio by patching `Twilio.prototype.request`, the
 * one method every resource call funnels through. That choke point is an
 * implementation detail of the SDK: a major `twilio` upgrade could move it,
 * and nothing else in the suite would notice — tests would keep passing while
 * quietly billing and delivering real SMS from developer machines and CI.
 *
 * The assertion drives the *production* client (`src/api/twilio`, the same
 * singleton `services/phone/router` sends through) rather than a locally
 * constructed one. A stub that only intercepts a throwaway client would prove
 * nothing about the path real code takes. It also covers the module-load
 * construction in `src/api/twilio.ts`: that client is built the moment the
 * module is imported, so if setup.ts ever stopped seeding a syntactically
 * valid account SID, this import would throw rather than fail silently.
 */
import { expect } from 'chai';
import twilioClient from '../../src/api/twilio';
import { resetSmsOutbox, smsOutbox } from '../helpers/outboundStubs';

describe('outbound transport stubs (test safety net)', () => {
    beforeEach(() => {
        resetSmsOutbox();
    });

    it('captures a Twilio send from the production client instead of putting it on the wire', async () => {
        const message = await twilioClient.messages.create({
            body: 'verification code 123456',
            // NANP reserved fictitious range (555-0100..555-0199), so a
            // regression in the stub dials nobody.
            to: '+13175550123',
            from: '+15551234567',
        });

        expect(smsOutbox).to.have.lengthOf(1);
        expect(smsOutbox[0].to).to.equal('+13175550123');
        expect(smsOutbox[0].from).to.equal('+15551234567');
        expect(smsOutbox[0].body).to.equal('verification code 123456');
        // The stub must still resolve to something message-shaped, or callers
        // that read the returned sid would break only under test.
        expect(message.sid).to.be.a('string');
    });
});
