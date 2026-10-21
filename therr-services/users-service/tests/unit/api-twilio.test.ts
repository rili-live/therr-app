import { expect } from 'chai';
import twilio from 'twilio';
import { resolveTwilioCredentials } from '../../src/api/twilio';

const ACCOUNT_SID = `AC${'1'.repeat(32)}`;
const API_KEY_SID = `SK${'2'.repeat(32)}`;

describe('resolveTwilioCredentials', () => {
    it('prefers an API key when both halves are set', () => {
        const credentials = resolveTwilioCredentials({
            TWILIO_ACCOUNT_SID: ACCOUNT_SID,
            TWILIO_AUTH_TOKEN: 'auth-token',
            TWILIO_API_KEY_SID: API_KEY_SID,
            TWILIO_API_KEY_SECRET: 'key-secret',
        });

        expect(credentials).to.deep.equal({
            mode: 'api-key', username: API_KEY_SID, password: 'key-secret', accountSid: ACCOUNT_SID,
        });
    });

    it('falls back to the Auth Token when no API key is configured', () => {
        const credentials = resolveTwilioCredentials({ TWILIO_ACCOUNT_SID: ACCOUNT_SID, TWILIO_AUTH_TOKEN: 'auth-token' });

        expect(credentials).to.deep.equal({
            mode: 'auth-token', username: ACCOUNT_SID, password: 'auth-token', accountSid: ACCOUNT_SID,
        });
    });

    it('falls back to the Auth Token when the API key is half-configured or malformed', () => {
        const base = { TWILIO_ACCOUNT_SID: ACCOUNT_SID, TWILIO_AUTH_TOKEN: 'auth-token' };

        expect(resolveTwilioCredentials({ ...base, TWILIO_API_KEY_SID: API_KEY_SID }).mode).to.equal('auth-token');
        expect(resolveTwilioCredentials({ ...base, TWILIO_API_KEY_SECRET: 'key-secret' }).mode).to.equal('auth-token');
        // An Account SID pasted into the key slot is the likeliest mistake.
        expect(resolveTwilioCredentials({ ...base, TWILIO_API_KEY_SID: ACCOUNT_SID, TWILIO_API_KEY_SECRET: 'key-secret' }).mode)
            .to.equal('auth-token');
    });

    it('builds a client the SDK accepts in API-key mode, scoped to the account', () => {
        const credentials = resolveTwilioCredentials({
            TWILIO_ACCOUNT_SID: ACCOUNT_SID,
            TWILIO_API_KEY_SID: API_KEY_SID,
            TWILIO_API_KEY_SECRET: 'key-secret',
        });
        const client = new twilio.Twilio(credentials.username, credentials.password, { accountSid: credentials.accountSid });

        expect(client.username).to.equal(API_KEY_SID);
        expect(client.accountSid).to.equal(ACCOUNT_SID);
    });
});
