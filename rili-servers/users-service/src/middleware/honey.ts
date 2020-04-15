import responseTime from 'response-time';
import Honey from 'libhoney';

const honey = new Honey({
    writeKey: process.env.HONEYCOMB_API_KEY,
    dataset: 'main',
});

export default responseTime((req, res, time) => {
    const serializedBody = {
        ...req.body,
        idToken: 'XXXXX',
        password: 'XXXXXX',
    };
    const serializedHeaders = {
        ...req.headers,
        authorization: 'Bearer XXXXX',
    };
    const serializedQuery = {
        ...req.query,
        idToken: 'XXXXX',
    };
    honey.sendNow({
        'honey.app': req.app,
        'honey.baseUrl': req.baseUrl,
        'honey.hostname': req.hostname,
        'honey.ip': req.ip,
        'honey.method': req.method,
        'honey.origin': req.origin,
        'honey.params': req.params,
        'honey.path': req.path,
        'honey.body': serializedBody,
        'honey.headers': serializedHeaders,
        'honey.query': serializedQuery,
        'honey.route': req.route,
        'honey.secure': req.secure,
        'honey.xhr': req.xhr,
        responseTime_ms: time, // eslint-disable-line @typescript-eslint/camelcase
    });
});
