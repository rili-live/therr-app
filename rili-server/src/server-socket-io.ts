import * as express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as Redis from 'ioredis';
import * as socketio from 'socket.io';
import * as socketioRedis from 'socket.io-redis';
import * as socketHandlers from './handlers/socket';
import { SocketServerActionTypes, SocketClientActionTypes } from 'rili-public-library/utilities/constants';
import printLogs from 'rili-public-library/utilities/print-logs';
import * as globalConfig from '../../global-config.js';
import RedisSession from './services/redis-session';
import getRoomsList from './utilities/get-socket-rooms-list';

export const rsAppName = 'riliChat';
// Session to attach socket.io details to username while logged in
export const shouldIncludeAllLogs = process.argv[2] === 'withAllLogs';
export const shouldIncludeLogs = process.argv[2] === 'withLogs';
export const shouldIncludeRedisLogs =  process.argv[2] === 'withRedisLogs'
    || shouldIncludeAllLogs;
export const shouldIncludeSocketLogs = process.argv[2] === 'withSocketLogs'
    || shouldIncludeAllLogs
    || shouldIncludeRedisLogs;

const nodes = [
    // Pub
    {
        host: globalConfig[process.env.NODE_ENV].redisHost,
        port: globalConfig[process.env.NODE_ENV].redisPubPort
    },
    // Sub
    {
        host: globalConfig[process.env.NODE_ENV].redisHost,
        port: globalConfig[process.env.NODE_ENV].redisSubPort
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
        redisPub.monitor().then(function (monitor) {
            monitor.on('monitor', function (time, args, source, database) {
                printLogs(true, `REDIS_PUB_LOG`, time, `Source: ${source}, Database: ${database}`, ...args);
            });
        });
    }

    // Wait for both pub and sub redis instances to connect before starting Express/Socket.io server
    startExpressSocketIOServer();
});

const startExpressSocketIOServer = () => {
    let app = express();
    let httpsServer;
    if (process.env.NODE_ENV === 'development') {
        httpsServer = http.createServer(app);
    } else if (process.env.NODE_ENV === 'production') {
        let httpsCredentials = {
            key: fs.readFileSync(globalConfig[process.env.NODE_ENV].security.keyLocation),
            cert: fs.readFileSync(globalConfig[process.env.NODE_ENV].security.certLocation),
        };
        httpsServer = https.createServer(httpsCredentials, app);
    }
    let server = httpsServer.listen(globalConfig[process.env.NODE_ENV].socketPort, (err: string) => {
        const port = globalConfig[process.env.NODE_ENV].socketPort;
        printLogs(true, 'SOCKET_IO_LOGS', null, `Server running on port, ${port}, with process id ${process.pid}`);
    });
    // NOTE: engine.io config options https://github.com/socketio/engine.io#methods-1
    let io = socketio(server, {
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
    //     printLogs(shouldIncludeRedisLogs, 'REDIS_PUB_CLUSTER_CONNECTION_ERROR:', null, error);
    // });
    // redisSubCluster.on('error', (error: string) => {
    //     printLogs(shouldIncludeRedisLogs, 'REDIS_SUB_CLUSTER_CONNECTION_ERROR:', null, error);
    // });

    redisAdapter.pubClient.on('error', (err: string) => {
        printLogs(shouldIncludeRedisLogs, 'REDIS_PUB_CLIENT_ERROR', null, err);
    });
    redisAdapter.subClient.on('error', (err: string) => {
        printLogs(shouldIncludeRedisLogs, 'REDIS_SUB_CLIENT_ERROR', null, err);
    });

    redisAdapter.subClient.on('subscribe', (channel: any, count: any) => {
        printLogs(shouldIncludeRedisLogs, 'REDIS_SUB_CLIENT', null, `Subscribed to ${channel}. Now subscribed to ${count} channel(s).`);
    });

    redisAdapter.subClient.on('message', (channel: any, message: any) => {
        printLogs(shouldIncludeRedisLogs, 'REDIS_SUB_CLIENT', null, `Message from channel ${channel}: ${message}`);
    });

    io.on('connection', (socket: socketio.Socket) => {
        printLogs(shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, 'NEW CONNECTION...');
        printLogs(shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `All Rooms: ${JSON.stringify(getRoomsList(io.sockets.adapter.rooms))}`);

        socket.emit(SocketServerActionTypes.SEND_ROOMS_LIST, getRoomsList(io.sockets.adapter.rooms));

        // Event sent from socket.io, redux store middleware
        socket.on('action', (action: any) => {
            if (action.type === SocketClientActionTypes.JOIN_ROOM) {
                socketHandlers.joinRoom(socket, redisSession, action.data);
            }
            if (action.type === SocketClientActionTypes.SEND_MESSAGE) {
                socketHandlers.sendMessage(socket, action.data);
            }
        });

        socket.on('disconnecting', (reason: string) => {
            // TODO: Use constants to mitigate disconnect reasons
            printLogs(shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `DISCONNECTING... ${reason}`);
            leaveAndNotifyRooms(socket);
        });
    });
};

const leaveAndNotifyRooms = (socket: SocketIO.Socket) => {
    const activeRooms = Object.keys(socket.rooms)
        .filter((room) => room !== socket.id);

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
                printLogs(shouldIncludeRedisLogs, 'REDIS_SESSION_ERROR', null, err);
            });
        }
};
