import beeline from './beeline'; // eslint-disable-line import/order
import express from 'express';
import * as http from 'http';
import moment from 'moment';
import socketio from 'socket.io';
import socketioRedis from 'socket.io-redis';
import { LogLevelMap, SocketServerActionTypes, SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import * as socketHandlers from './handlers';
import * as Constants from './constants/index';
import * as globalConfig from '../../../global-config.js';
import getSocketRoomsList from './utilities/get-socket-rooms-list';
import redisClient from './store/redisClient';
import redisSessions from './store/redisSessions';

export const rsAppName = 'riliChat';

let serverObj: http.Server;

const leaveAndNotifyRooms = (socket: SocketIO.Socket) => {
    const activeRooms = Object.keys(socket.rooms)
        .filter((room) => room !== socket.id);

    if (activeRooms.length) {
        redisSessions.getBySocketId(socket.id).then((response: any) => {
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
                level: 'verbose',
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err,
                tracer: beeline,
                traceArgs: {
                    socketId: socket.id,
                    activeRooms,
                },
            });
        });
    }
};

const startExpressSocketIOServer = () => {
    const app = express();
    const { SOCKET_PORT } = process.env;

    const server = http.createServer(app);
    serverObj = server.listen(Number(SOCKET_PORT), () => {
        printLogs({
            level: 'info',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `Server running on port, ${SOCKET_PORT}, with process id ${process.pid}`,
            tracer: beeline,
            traceArgs: {
                port: SOCKET_PORT,
                processId: process.pid,
            },
        });
    });
    // NOTE: engine.io config options https://github.com/socketio/engine.io#methods-1
    const io = socketio(server, {
        path: '/socketio',
        // how many ms before sending a new ping packet
        pingInterval: Number(globalConfig[process.env.NODE_ENV || 'development'].socket.pingInterval),
        // how many ms without a pong packet to consider the connection closed
        pingTimeout: Number(globalConfig[process.env.NODE_ENV || 'development'].socket.pingTimeout),
    });

    io.on('error', (error: string) => {
        console.log(error); // eslint-disable-line no-console
    });

    const redisAdapter = socketioRedis({
        pubClient: redisClient,
        // pubClient: redisCluster,
    });

    io.adapter(redisAdapter);

    // Redis Error handling
    // redisPubCluster.on('error', (error: string) => {
    // printLogs({
    //     info: 'verbose',
    //     messageOrigin: 'REDIS_PUB_CLUSTER_CONNECTION_ERROR',
    //     messages: error.toString(),
    //     tracer: beeline,
    //     traceArgs: {},
    // });
    // });
    // redisSubCluster.on('error', (error: string) => {
    // printLogs({
    //     info: 'verbose',
    //     messageOrigin: 'REDIS_SUB_CLUSTER_CONNECTION_ERROR:',
    //     messages: error.toString(),
    //     messages: error.toString(),
    //     tracer: beeline,
    //     traceArgs: {},
    // });
    // });

    redisAdapter.pubClient.on('error', (err: string) => {
        printLogs({
            info: 'verbose',
            messageOrigin: 'REDIS_PUB_CLIENT_ERROR',
            messages: err.toString(),
            tracer: beeline,
            traceArgs: {
                uid: redisAdapter.uid,
            },
        });
    });
    redisAdapter.subClient.on('error', (err: string) => {
        printLogs({
            info: 'verbose',
            messageOrigin: 'REDIS_SUB_CLIENT_ERROR',
            messages: err.toString(),
            tracer: beeline,
            traceArgs: {
                uid: redisAdapter.uid,
            },
        });
    });

    redisAdapter.subClient.on('subscribe', (channel: any, count: any) => {
        printLogs({
            info: 'verbose',
            messageOrigin: 'REDIS_SUB_CLIENT',
            messages: `Subscribed to ${channel}. Now subscribed to ${count} channel(s).`,
            tracer: beeline,
            traceArgs: {
                uid: redisAdapter.uid,
            },
        });
    });

    redisAdapter.subClient.on('message', (channel: any, message: any) => {
        printLogs({
            info: 'verbose',
            messageOrigin: 'REDIS_SUB_CLIENT',
            messages: `Message from channel ${channel}: ${message}`,
            tracer: beeline,
            traceArgs: {
                uid: redisAdapter.uid,
            },
        });
    });

    io.on('connection', (socket: socketio.Socket) => {
        printLogs({
            level: 'info',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: 'NEW CONNECTION...',
            tracer: beeline,
            traceArgs: {
                socketId: socket.id,
            },
        });
        printLogs({
            level: 'info',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `All Rooms: ${JSON.stringify(getSocketRoomsList(io.sockets.adapter.rooms))}`,
            tracer: beeline,
            traceArgs: {
                socketId: socket.id,
            },
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
                    socketHandlers.joinRoom(socket, action.data);
                    break;
                case SocketClientActionTypes.LOGIN:
                    socketHandlers.login({
                        appName: rsAppName,
                        socket,
                        data: action.data,
                    });
                    break;
                case SocketClientActionTypes.LOGOUT:
                    socketHandlers.logout({
                        socket,
                        data: action.data,
                    });
                    break;
                case SocketClientActionTypes.SEND_MESSAGE:
                    socketHandlers.sendMessage(socket, action.data);
                    break;
                case SocketClientActionTypes.UPDATE_NOTIFICATION:
                    socketHandlers.updateNotification(socket, action.data);
                    break;
                default:
                    break;
            }
        });

        socket.on('disconnecting', (reason: string) => {
            // TODO: Use constants to mitigate disconnect reasons
            printLogs({
                level: 'info',
                messageOrigin: 'SOCKET_IO_LOGS',
                messages: `DISCONNECTING... ${reason}`,
                tracer: beeline,
                traceArgs: {
                    socketId: socket.id,
                },
            });
            leaveAndNotifyRooms(socket);
        });
    });
};

// We must connect manually since lazyConnect is true
const redisConnectPromises = [redisClient.connect()];

Promise.all(redisConnectPromises).then((responses: any[]) => {
    // connection ready
    if ((Number(process.env.LOG_LEVEL) || 2) <= LogLevelMap.verbose) {
        redisClient.monitor().then((monitor) => {
            monitor.on('monitor', (time, args, source, database) => {
                printLogs({
                    time,
                    level: 'verbose',
                    messageOrigin: 'REDIS_PUB_LOG',
                    messages: [`Source: ${source}, Database: ${database}`, ...args],
                    tracer: beeline,
                    traceArgs: {},
                });
            });
        });
    }

    // Wait for both pub and sub redis instances to connect before starting Express/Socket.io server
    startExpressSocketIOServer();
});

// Hot Module Reloading
type ModuleId = string | number;

interface WebpackHotModule {
    hot?: {
        data: any;
        accept(
            dependencies: string[],
            callback?: (updatedDependencies: ModuleId[]) => void,
        ): void;
        accept(dependency: string, callback?: () => void): void;
        accept(errHandler?: (err: Error) => void): void;
        dispose(callback: (data: any) => void): void;
    };
}

declare const module: WebpackHotModule;

if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept();
    module.hot.dispose(() => serverObj.close());
}
