import beeline from '../beeline';

export default (req, res, next) => {
    const serializedBody = {
        ...req.body,
    };
    if (req.body && req.body.idToken) {
        serializedBody.idToken = 'XXXXX';
    }
    if (req.body && req.body.password) {
        serializedBody.password = 'XXXXX';
    }
    const serializedHeaders = {
        ...req.headers,
        authorization: 'Bearer XXXXX',
    };
    const serializedQuery = {
        ...req.query,
        idToken: 'XXXXX',
    };
    if (req.query && req.query.idToken) {
        serializedQuery.idToken = 'XXXXX';
    }
    beeline.addContext({
        'middleware.app': req.app,
        'middleware.baseUrl': req.baseUrl,
        'middleware.hostname': req.hostname,
        'middleware.ip': req.ip,
        'middleware.method': req.method,
        'middleware.origin': req.origin,
        'middleware.params': req.params,
        'middleware.path': req.path,
        'middleware.body': serializedBody,
        'middleware.headers': serializedHeaders,
        'middleware.query': serializedQuery,
        'middleware.route': req.route,
        'middleware.secure': req.secure,
        'middleware.xhr': req.xhr,
    });

    return next();
};
