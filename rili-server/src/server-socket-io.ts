import * as express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as Redis from 'ioredis';
import * as socketio from 'socket.io';
import * as socketioRedis from 'socket.io-redis';
import * as socketHandlers from './handlers/socket';
import { SocketServerActionTypes, SocketClientActionTypes } from 'rili-public-library/utilities/constants';
import * as Constants from './constants';
import printLogs from 'rili-public-library/utilities/print-logs';
import * as globalConfig from '../../global-config.js';
import RedisSession from './services/RedisSession';
import getSocketRoomsList from './utilities/get-socket-rooms-list';

export const rsAppName = 'riliChat';
// Session to attach socket.io details to username while logged in
export const shouldIncludeAllLogs = process.argv[2] === 'withAllLogs';
export const shouldIncludeRedisLogs =  process.argv[2] === 'withRedisLogs'
    || shouldIncludeAllLogs;
export const shouldIncludeSocketLogs = process.argv[2] === 'withSocketLogs'
    || shouldIncludeAllLogs
    || shouldIncludeRedisLogs;

const nodes = [
    // Pub
    {
        host: globalConfig[process.env.NODE_ENV].redisHost,
        port: globalConfig[process.env.NODE_ENV].redisPubPort,
    },
    // Sub
    {
        host: globalConfig[process.env.NODE_ENV].redisHost,
        port: globalConfig[process.env.NODE_ENV].redisSubPort,
    },
];

// TODO: RSERV-6: Configure redis clusters
// NOTE: Redis cluster only works on Docker for Linux (ie. Ubuntu) using the host network (https://docs.docker.com/network/host/)
// const redisPubCluster = new Redis.Cluster(nodes);
// const redisSubCluster = new Redis.Cluster(nodes);

const redisPub: Redis.Redis = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketPub',
    lazyConnect: true,
});

const redisSession = new RedisSession({
    client: redisPub,
});

// TODO: RSERV-5: PubSub doesn't seem to work when on different ports
// This might simply require redis clusters
const redisSub: Redis.Redis = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketSub',
    lazyConnect: true,
});

// We must connect manually since lazyConnect is true
const redisConnectPromises = [redisPub.connect(), redisSub.connect()];

Promise.all(redisConnectPromises).then((responses: any[]) => {
    // connection ready
    if (shouldIncludeRedisLogs) {
        redisPub.monitor().then((monitor) => {
            monitor.on('monitor', (time, args, source, database) => {
                printLogs({
                    time,
                    shouldPrintLogs: true,
                    messageOrigin: `REDIS_PUB_LOG`,
                    messages: [`Source: ${source}, Database: ${database}`, ...args],
                });
            });
        });
    }

    // Wait for both pub and sub redis instances to connect before starting Express/Socket.io server
    startExpressSocketIOServer();
});

const startExpressSocketIOServer = () => {
    const app = express();
    let httpsServer;
    if (process.env.NODE_ENV === 'development') {
        httpsServer = http.createServer(app);
    } else if (process.env.NODE_ENV === 'production') {
        const httpsCredentials = {
            key: fs.readFileSync(globalConfig[process.env.NODE_ENV].security.keyLocation),
            cert: fs.readFileSync(globalConfig[process.env.NODE_ENV].security.certLocation),
        };
        httpsServer = https.createServer(httpsCredentials, app);
    }
    const server = httpsServer.listen(globalConfig[process.env.NODE_ENV].socketPort, (err: string) => {
        const port = globalConfig[process.env.NODE_ENV].socketPort;
        printLogs({
            shouldPrintLogs: true,
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `Server running on port, ${port}, with process id ${process.pid}`,
        });
    });
    // NOTE: engine.io config options https://github.com/socketio/engine.io#methods-1
    const io = socketio(server, {
        // how many ms before sending a new ping packet
        pingInterval: globalConfig[process.env.NODE_ENV].socket.pingInterval,
        // how many ms without a pong packet to consider the connection closed
        pingTimeout: globalConfig[process.env.NODE_ENV].socket.pingTimeout,
    });

    const redisAdapter = socketioRedis({
        pubClient: redisPub,
        subClient: redisSub,
        // pubClient: redisPubCluster,
        // subClient: redisSubCluster,
    });

    io.adapter(redisAdapter);

    // Redis Error handling
    // redisPubCluster.on('error', (error: string) => {
        // printLogs({
        //     shouldPrintLogs: shouldIncludeRedisLogs,
        //     messageOrigin: 'REDIS_PUB_CLUSTER_CONNECTION_ERROR',
        //     messages: error.toString(),
        // });
    // });
    // redisSubCluster.on('error', (error: string) => {
        // printLogs({
        //     shouldPrintLogs: shouldIncludeRedisLogs,
        //     messageOrigin: 'REDIS_SUB_CLUSTER_CONNECTION_ERROR:',
        //     messages: error.toString(),
        // });
    // });

    redisAdapter.pubClient.on('error', (err: string) => {
        printLogs({
            shouldPrintLogs: shouldIncludeRedisLogs,
            messageOrigin: 'REDIS_PUB_CLIENT_ERROR',
            messages: err.toString(),
        });
    });
    redisAdapter.subClient.on('error', (err: string) => {
        printLogs({
            shouldPrintLogs: shouldIncludeRedisLogs,
            messageOrigin: 'REDIS_SUB_CLIENT_ERROR',
            messages: err.toString(),
        });
    });

    redisAdapter.subClient.on('subscribe', (channel: any, count: any) => {
        printLogs({
            shouldPrintLogs: shouldIncludeRedisLogs,
            messageOrigin: 'REDIS_SUB_CLIENT',
            messages: `Subscribed to ${channel}. Now subscribed to ${count} channel(s).`,
        });
    });

    redisAdapter.subClient.on('message', (channel: any, message: any) => {
        printLogs({
            shouldPrintLogs: shouldIncludeRedisLogs,
            messageOrigin: 'REDIS_SUB_CLIENT',
            messages: `Message from channel ${channel}: ${message}`,
        });
    });

    io.on('connection', (socket: socketio.Socket) => {
        printLogs({
            shouldPrintLogs: shouldIncludeSocketLogs,
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: 'NEW CONNECTION...',
        });
        printLogs({
            shouldPrintLogs: shouldIncludeSocketLogs,
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `All Rooms: ${JSON.stringify(getSocketRoomsList(io.sockets.adapter.rooms))}`,
        });

        // Send a list of the currently active chat rooms when user connects
        socket.emit(Constants.ACTION, {
            type: SocketServerActionTypes.SEND_ROOMS_LIST,
            data: getSocketRoomsList(io.sockets.adapter.rooms),
        });

        // Event sent from socket.io, redux store middleware
        socket.on(Constants.ACTION, (action: any) => {
            if (action.type === SocketClientActionTypes.JOIN_ROOM) {
                socketHandlers.joinRoom(socket, redisSession, action.data);
            }
            if (action.type === SocketClientActionTypes.LOGIN) {
                socketHandlers.login(socket, redisSession, action.data);
            }
            if (action.type === SocketClientActionTypes.SEND_MESSAGE) {
                socketHandlers.sendMessage(socket, action.data);
            }
        });

        socket.on('disconnecting', (reason: string) => {
            // TODO: Use constants to mitigate disconnect reasons
            printLogs({
                shouldPrintLogs: shouldIncludeSocketLogs,
                messageOrigin: 'SOCKET_IO_LOGS',
                messages: `DISCONNECTING... ${reason}`,
            });
            leaveAndNotifyRooms(socket);
        });
    });
};

const leaveAndNotifyRooms = (socket: SocketIO.Socket) => {
    const activeRooms = Object.keys(socket.rooms)
        .filter(room => room !== socket.id);

    if (activeRooms.length) {
        redisSession.get(socket.id).then((response: any) => {
            activeRooms.forEach((room) => {
                const parsedResponse = JSON.parse(response);
                if (parsedResponse && parsedResponse.userName) {
                    socket.broadcast.to(room).emit('event', {
                        type: SocketServerActionTypes.DISCONNECT,
                        data: `${parsedResponse.userName} left the room`,
                    });
                }
            });
        }).catch((err: any) => {
            printLogs({
                shouldPrintLogs: shouldIncludeRedisLogs,
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err,
            });
        });
    }
};
