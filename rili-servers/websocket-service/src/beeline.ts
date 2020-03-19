import HoneycombBeeline from 'honeycomb-beeline'; // eslint-disable-line import/newline-after-import
const beeline = HoneycombBeeline({
    writeKey: process.env.HONEYCOMB_API_KEY,
    dataset: 'main',
    serviceName: 'websocket-service',

    /* ... additional optional configuration ... */
});

export default beeline;
