import beeline from '../beeline';

export default (req, res, next) => {
    const serializedHeaders = {
        ...req.headers,
        authorization: 'Bearer XXXXX',
    };
    beeline.addContext({
        'middleware.app': req.app,
        'middleware.baseUrl': req.baseUrl,
        'middleware.hostname': req.hostname,
        'middleware.ip': req.ip,
        'middleware.method': req.method,
        'middleware.origin': req.origin,
        'middleware.params': req.params,
        'middleware.path': req.path,
        'middleware.body': req.body,
        'middleware.headers': serializedHeaders,
        'middleware.query': req.query,
        'middleware.route': req.route,
        'middleware.secure': req.secure,
        'middleware.xhr': req.xhr,
    });

    return next();
};
