import twilio from 'twilio';

// Lazy-init so unit tests that transitively import this module don't crash
// at module load when TWILIO_ACCOUNT_SID is unset — the Twilio constructor
// throws on an empty SID. The real client is built on first property access.
let cachedClient: ReturnType<typeof buildClient> | undefined;

function buildClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    return new twilio.Twilio(accountSid, authToken);
}

const clientProxy = new Proxy({} as ReturnType<typeof buildClient>, {
    get(_target, prop) {
        if (!cachedClient) {
            cachedClient = buildClient();
        }
        return (cachedClient as any)[prop];
    },
});

export default clientProxy;
