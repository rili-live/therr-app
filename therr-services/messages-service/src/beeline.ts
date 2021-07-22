import HoneycombBeeline from 'honeycomb-beeline'; // eslint-disable-line import/newline-after-import
const beeline = HoneycombBeeline({
    writeKey: process.env.HONEYCOMB_API_KEY,
    dataset: process.env.LOGGING_DATASET,
    serviceName: 'messages-service',

    /* ... additional optional configuration ... */
});

export default beeline;
