/**
 * Local-only proxy for viewing the Friends with Habits site in a browser.
 *
 * The habits pages are selected by hostname, not by path: the middleware in
 * src/server-client.tsx only short-circuits React SSR when `req.hostname` is in
 * HABITS_HOSTS (habits.therr.com / www.habits.therr.com). Browsing
 * http://localhost:7070/ therefore renders the Therr home page instead.
 *
 * This forwards every request to the real dev server with the Host header
 * rewritten, so the habits routes match without adding an /etc/hosts alias that
 * would shadow the production domain machine-wide.
 *
 * In development the app does not set `trust proxy` (server-client.tsx), so
 * Express reads Host directly and no X-Forwarded-* header is needed.
 */

/* eslint-disable no-console, @typescript-eslint/no-var-requires -- plain-node dev script, like update-views.js */

const http = require('http');

const HABITS_HOST = 'habits.therr.com';
const PROXY_PORT = Number(process.env.HABITS_PROXY_PORT || 7071);
const TARGET_PORT = Number(process.env.CLIENT_PORT || 7070);
const TARGET_HOST = '127.0.0.1';

// Redirects issued by the app are absolute (https://habits.therr.com/...). Point
// them back at the proxy so a redirect during local browsing doesn't jump to prod.
const rewriteLocation = (location) => {
    if (!location) {
        return location;
    }

    return location.replace(
        new RegExp(`^https?://(?:www\\.)?${HABITS_HOST.replace(/\./g, '\\.')}`),
        `http://localhost:${PROXY_PORT}`,
    );
};

const server = http.createServer((req, res) => {
    const headers = {
        ...req.headers,
        host: HABITS_HOST,
    };

    const upstream = http.request({
        host: TARGET_HOST,
        port: TARGET_PORT,
        method: req.method,
        path: req.url,
        headers,
    }, (upstreamRes) => {
        const responseHeaders = { ...upstreamRes.headers };
        if (responseHeaders.location) {
            responseHeaders.location = rewriteLocation(responseHeaders.location);
        }

        res.writeHead(upstreamRes.statusCode, responseHeaders);
        upstreamRes.pipe(res);
    });

    upstream.on('error', (err) => {
        const isDown = err.code === 'ECONNREFUSED';
        const message = isDown
            ? `Dev server is not running on ${TARGET_HOST}:${TARGET_PORT}. Start it with \`npm start\` (after \`npm run build:dev\`).`
            : `Proxy error: ${err.message}`;

        console.error(`[habits-proxy] ${message}`);
        res.writeHead(isDown ? 503 : 502, { 'Content-Type': 'text/plain' });
        res.end(message);
    });

    req.pipe(upstream);
});

server.listen(PROXY_PORT, () => {
    console.info(`[habits-proxy] Friends with Habits → http://localhost:${PROXY_PORT}`);
    console.info(`[habits-proxy] Forwarding to ${TARGET_HOST}:${TARGET_PORT} as Host: ${HABITS_HOST}`);
});
