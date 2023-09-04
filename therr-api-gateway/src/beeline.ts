import HoneycombBeeline from 'honeycomb-beeline'; // eslint-disable-line import/newline-after-import
// eslint-disable-next-line @typescript-eslint/no-unused-vars

const beeline = HoneycombBeeline({
    writeKey: process.env.HONEYCOMB_API_KEY,
    serviceName: 'therr-api-gateway',

    /* ... additional optional configuration ... */
});

export default beeline;
