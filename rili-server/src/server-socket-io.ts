import * as express from 'express';
import * as http from 'http';
import * as moment from 'moment';
import * as Redis from 'ioredis';
import * as socketio from 'socket.io';
import * as socketioRedis from 'socket.io-redis';
import { argv } from 'yargs';
import * as socketHandlers from './socketio/handlers';
import { SocketServerActionTypes, SocketClientActionTypes } from 'rili-public-library/utilities/constants';
import * as Constants from './constants';
import printLogs from 'rili-public-library/utilities/print-logs';
import * as globalConfig from '../../global-config.js';
import RedisSession from './socketio/services/RedisSession';
import getSocketRoomsList from './utilities/get-socket-rooms-list';

export const rsAppName = 'riliChat';
export const shouldPrintAllLogs = argv.withAllLogs;
export const shouldPrintRedisLogs =  argv.withRedisLogs || shouldPrintAllLogs;
export const shouldPrintSocketLogs = argv.withSocketLogs || shouldPrintAllLogs || shouldPrintRedisLogs;

const nodes = [
    // Pub
    {
        host: process.env.REDIS_PUB_HOST,
        port: Number(process.env.REDIS_PUB_PORT),
    },
    // Sub
    {
        host: process.env.REDIS_SUB_HOST,
        port: Number(process.env.REDIS_PUB_PORT),
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
    if (shouldPrintRedisLogs) {
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
    const { SOCKET_PORT } = process.env;

    const server = http.createServer(app);
    server.listen(Number(SOCKET_PORT), () => {
        printLogs({
            shouldPrintLogs: true,
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `Server running on port, ${SOCKET_PORT}, with process id ${process.pid}`,
        });
    });
    // NOTE: engine.io config options https://github.com/socketio/engine.io#methods-1
    const io = socketio(server, {
        path: '/ws',
        // how many ms before sending a new ping packet
        pingInterval: Number(globalConfig[process.env.NODE_ENV].socket.pingInterval),
        // how many ms without a pong packet to consider the connection closed
        pingTimeout: Number(globalConfig[process.env.NODE_ENV].socket.pingTimeout),
    });

    io.on('error', (error: string) => {
        console.log(error); // tslint:disable-line no-console
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
        //     shouldPrintLogs: shouldPrintRedisLogs,
        //     messageOrigin: 'REDIS_PUB_CLUSTER_CONNECTION_ERROR',
        //     messages: error.toString(),
        // });
    // });
    // redisSubCluster.on('error', (error: string) => {
        // printLogs({
        //     shouldPrintLogs: shouldPrintRedisLogs,
        //     messageOrigin: 'REDIS_SUB_CLUSTER_CONNECTION_ERROR:',
        //     messages: error.toString(),
        // });
    // });

    redisAdapter.pubClient.on('error', (err: string) => {
        printLogs({
            shouldPrintLogs: shouldPrintRedisLogs,
            messageOrigin: 'REDIS_PUB_CLIENT_ERROR',
            messages: err.toString(),
        });
    });
    redisAdapter.subClient.on('error', (err: string) => {
        printLogs({
            shouldPrintLogs: shouldPrintRedisLogs,
            messageOrigin: 'REDIS_SUB_CLIENT_ERROR',
            messages: err.toString(),
        });
    });

    redisAdapter.subClient.on('subscribe', (channel: any, count: any) => {
        printLogs({
            shouldPrintLogs: shouldPrintRedisLogs,
            messageOrigin: 'REDIS_SUB_CLIENT',
            messages: `Subscribed to ${channel}. Now subscribed to ${count} channel(s).`,
        });
    });

    redisAdapter.subClient.on('message', (channel: any, message: any) => {
        printLogs({
            shouldPrintLogs: shouldPrintRedisLogs,
            messageOrigin: 'REDIS_SUB_CLIENT',
            messages: `Message from channel ${channel}: ${message}`,
        });
    });

    io.on('connection', (socket: socketio.Socket) => {
        printLogs({
            shouldPrintLogs: shouldPrintSocketLogs,
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: 'NEW CONNECTION...',
        });
        printLogs({
            shouldPrintLogs: shouldPrintSocketLogs,
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
            switch (action.type) {
            case SocketClientActionTypes.JOIN_ROOM:
                socketHandlers.joinRoom(socket, redisSession, action.data);
                break;
            case SocketClientActionTypes.LOGIN:
                socketHandlers.login(socket, redisSession, action.data);
                break;
            case SocketClientActionTypes.LOGOUT:
                socketHandlers.logout(socket, redisSession, action.data);
                break;
            case SocketClientActionTypes.SEND_MESSAGE:
                socketHandlers.sendMessage(socket, action.data);
                break;
            default:
                break;
            }
        });

        socket.on('disconnecting', (reason: string) => {
            // TODO: Use constants to mitigate disconnect reasons
            printLogs({
                shouldPrintLogs: shouldPrintSocketLogs,
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
                    const now = moment(Date.now()).format('MMMM D/YY, h:mma');
                    socket.broadcast.to(room).emit(Constants.ACTION, {
                        type: SocketServerActionTypes.LEFT_ROOM,
                        data: {
                            roomId: room,
                            message: {
                                key: Date.now().toString(),
                                time: now,
                                text: `${parsedResponse.userName} left the room`,
                            },
                        },
                    });
                }
            });
        }).catch((err: any) => {
            printLogs({
                shouldPrintLogs: shouldPrintRedisLogs,
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err,
            });
        });
    }
};
