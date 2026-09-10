import * as http from 'http';
import * as https from 'https';

// Shared keep-alive agents reuse TCP connections across requests to the same host,
// avoiding repeated DNS lookups and TCP handshakes on every axios call.
const httpKeepAliveAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
});

const httpsKeepAliveAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 25,
    maxFreeSockets: 5,
});

export { httpKeepAliveAgent, httpsKeepAliveAgent };
