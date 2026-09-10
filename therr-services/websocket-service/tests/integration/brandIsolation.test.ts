/**
 * Integration Tests - WebSocket Brand Isolation (Phase 6 scenario 4)
 *
 * Verifies that two sockets for the same user, one per brand, are isolated:
 * a forum-message scoped to the Therr forum room must only reach the Therr socket.
 *
 * Uses a real in-memory socket.io Server with two socket.io-client connections.
 * No Redis adapter is needed — this test exercises the room-key invariant in a
 * single Server instance, which is what `getRoomKey(brand, roomId)` guarantees
 * regardless of how the room set is replicated across nodes.
 */
import { expect } from 'chai';
import http from 'http';
import { AddressInfo } from 'net';
import { Server, Socket as ServerSocket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { BrandVariations } from 'therr-js-utilities/constants';
import { getRoomKey, FORUM_PREFIX } from '../../src/handlers/rooms';

const FORUM_ID = 'forum-room-xyz';
const SAMPLE_EVENT = 'sample-forum-message';

const waitForEvent = (socket: ClientSocket, event: string, timeoutMs = 250): Promise<unknown | 'timeout'> => new Promise(
    (resolve) => {
        const timer = setTimeout(() => resolve('timeout'), timeoutMs);
        socket.once(event, (payload: unknown) => {
            clearTimeout(timer);
            resolve(payload);
        });
    },
);

describe('WebSocket Brand Isolation (Phase 6 scenario 4)', () => {
    let httpServer: http.Server;
    let io: Server;
    let port: number;
    let therrClient: ClientSocket;
    let habitsClient: ClientSocket;
    let therrServerSocket: ServerSocket;
    let habitsServerSocket: ServerSocket;

    before((done) => {
        httpServer = http.createServer();
        io = new Server(httpServer);

        // The handshake "brand" mirrors how the production gateway forwards x-brand-variation
        // into the socket connection: we pluck it from auth and stash it on the server-side
        // socket so room joins can derive the room key from the authenticated context.
        io.on('connection', (socket) => {
            const brand = (socket.handshake.auth?.brand as string) || BrandVariations.THERR;

            socket.on('test:join-forum', (roomId: string) => {
                socket.join(getRoomKey(brand, roomId));
                socket.emit('test:joined');
            });

            // Stash the server-side socket reference so the test can drive emits
            // exactly the way handlers/rooms.ts and handlers/messages.ts do.
            if (brand === BrandVariations.THERR) therrServerSocket = socket;
            if (brand === BrandVariations.HABITS) habitsServerSocket = socket;
        });

        httpServer.listen(() => {
            port = (httpServer.address() as AddressInfo).port;
            done();
        });
    });

    after((done) => {
        if (therrClient?.connected) therrClient.disconnect();
        if (habitsClient?.connected) habitsClient.disconnect();
        io.close(() => httpServer.close(() => done()));
    });

    beforeEach(async () => {
        therrClient = ioClient(`http://localhost:${port}`, {
            auth: { brand: BrandVariations.THERR },
            transports: ['websocket'],
            forceNew: true,
        });
        habitsClient = ioClient(`http://localhost:${port}`, {
            auth: { brand: BrandVariations.HABITS },
            transports: ['websocket'],
            forceNew: true,
        });

        await Promise.all([
            new Promise<void>((resolve) => {
                therrClient.on('connect', () => resolve());
            }),
            new Promise<void>((resolve) => {
                habitsClient.on('connect', () => resolve());
            }),
        ]);

        // Both clients join the same forum ID; the brand-prefixed room key
        // means they land in two distinct socket.io rooms.
        therrClient.emit('test:join-forum', FORUM_ID);
        habitsClient.emit('test:join-forum', FORUM_ID);

        await Promise.all([
            new Promise<void>((resolve) => {
                therrClient.on('test:joined', () => resolve());
            }),
            new Promise<void>((resolve) => {
                habitsClient.on('test:joined', () => resolve());
            }),
        ]);
    });

    afterEach(() => {
        if (therrClient?.connected) therrClient.disconnect();
        if (habitsClient?.connected) habitsClient.disconnect();
    });

    it('routes forum messages only to the matching brand socket', async () => {
        // Therr-stamped emit goes only to therr room key; Habits client must not see it.
        const therrPromise = waitForEvent(therrClient, SAMPLE_EVENT);
        const habitsPromise = waitForEvent(habitsClient, SAMPLE_EVENT);

        io.to(getRoomKey(BrandVariations.THERR, FORUM_ID)).emit(SAMPLE_EVENT, {
            text: 'Therr-only',
        });

        const [therrPayload, habitsPayload] = await Promise.all([therrPromise, habitsPromise]);

        expect(therrPayload).to.deep.equal({ text: 'Therr-only' });
        expect(habitsPayload).to.equal('timeout');
    });

    it('routes the inverse direction symmetrically — Habits emit does not reach Therr', async () => {
        const habitsPromise = waitForEvent(habitsClient, SAMPLE_EVENT);
        const therrPromise = waitForEvent(therrClient, SAMPLE_EVENT);

        io.to(getRoomKey(BrandVariations.HABITS, FORUM_ID)).emit(SAMPLE_EVENT, {
            text: 'Habits-only',
        });

        const [habitsPayload, therrPayload] = await Promise.all([habitsPromise, therrPromise]);

        expect(habitsPayload).to.deep.equal({ text: 'Habits-only' });
        expect(therrPayload).to.equal('timeout');
    });

    it('places clients in distinct server-side room sets per brand', () => {
        // Sanity-check the underlying invariant: same forum ID, different room keys.
        const therrKey = getRoomKey(BrandVariations.THERR, FORUM_ID);
        const habitsKey = getRoomKey(BrandVariations.HABITS, FORUM_ID);
        expect(therrKey).to.equal(`therr:${FORUM_PREFIX}${FORUM_ID}`);
        expect(habitsKey).to.equal(`habits:${FORUM_PREFIX}${FORUM_ID}`);
        expect(therrKey).to.not.equal(habitsKey);

        expect(therrServerSocket.rooms.has(therrKey)).to.equal(true);
        expect(therrServerSocket.rooms.has(habitsKey)).to.equal(false);
        expect(habitsServerSocket.rooms.has(habitsKey)).to.equal(true);
        expect(habitsServerSocket.rooms.has(therrKey)).to.equal(false);
    });
});
