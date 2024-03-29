import HoneycombBeeline from 'honeycomb-beeline'; // eslint-disable-line import/newline-after-import
const beeline = HoneycombBeeline({
    writeKey: process.env.HONEYCOMB_API_KEY,
    serviceName: 'therr-server-client-dashboard',
    httpTracePropagationHook: HoneycombBeeline.w3c.httpTracePropagationHook,

    /* ... additional optional configuration ... */
});

export default beeline;
