import twilio from 'twilio';
import logSpan from 'therr-js-utilities/log-or-update-span';

/**
 * Which credential pair the Twilio client authenticates with.
 *
 * Preferred: an API key (`TWILIO_API_KEY_SID` = `SK…` + `TWILIO_API_KEY_SECRET`). Each service gets
 * its own key, so one can be revoked without touching the other, and the account's master Auth
 * Token stays out of production. Fallback: the Account SID + Auth Token pair this used before,
 * so a deploy that lands before the key secrets exist keeps sending.
 *
 * TODO: Remove the Auth Token fallback once both services run on API keys in production.
 * NOTE: users-service/src/api/twilio.ts has the same resolver — keep the two in step.
 */
export interface ITwilioCredentials {
    mode: 'api-key' | 'auth-token';
    username: string;
    password: string;
    accountSid: string;
}

export const resolveTwilioCredentials = (env: NodeJS.ProcessEnv = process.env): ITwilioCredentials => {
    const accountSid = env.TWILIO_ACCOUNT_SID || '';
    const apiKeySid = `${env.TWILIO_API_KEY_SID || ''}`.trim();
    const apiKeySecret = `${env.TWILIO_API_KEY_SECRET || ''}`.trim();

    if (apiKeySid.startsWith('SK') && apiKeySecret) {
        return {
            mode: 'api-key', username: apiKeySid, password: apiKeySecret, accountSid,
        };
    }

    if (apiKeySid || apiKeySecret) {
        // Half a key pair is a misconfiguration, not a choice — say so rather than quietly
        // carrying on with the Auth Token and leaving it in place.
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Twilio API key is incomplete or malformed (expected TWILIO_API_KEY_SID=SK… and TWILIO_API_KEY_SECRET); using Auth Token'],
            traceArgs: {},
        });
    }

    return {
        mode: 'auth-token', username: accountSid, password: env.TWILIO_AUTH_TOKEN || '', accountSid,
    };
};

const credentials = resolveTwilioCredentials();

logSpan({
    level: 'info',
    messageOrigin: 'API_SERVER',
    messages: [`Twilio client authenticating with ${credentials.mode}`],
    traceArgs: { 'twilio.authMode': credentials.mode },
});

// `accountSid` is required alongside an API key; with the Auth Token it is the username anyway.
const client = new twilio.Twilio(credentials.username, credentials.password, { accountSid: credentials.accountSid });

export default client;
