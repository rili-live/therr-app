import responseTime from 'response-time';
import Honey from 'libhoney';

const honey = new Honey({
    writeKey: process.env.HONEYCOMB_API_KEY,
    dataset: 'main',
});

export default responseTime((req, res, time) => {
    honey.sendNow({
        app: req.app,
        baseUrl: req.baseUrl,
        fresh: req.fresh,
        hostname: req.hostname,
        ip: req.ip,
        method: req.method,
        originalUrl: req.originalUrl,
        params: req.params,
        path: req.path,
        protocol: req.protocol,
        query: req.query,
        route: req.route,
        secure: req.secure,
        xhr: req.xhr,
        responseTime_ms: time, // eslint-disable-line @typescript-eslint/camelcase
    });
});
