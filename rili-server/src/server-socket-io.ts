import * as express from 'express';
import * as Redis from 'ioredis';
import * as socketio from 'socket.io';
import * as socketioRedis from 'socket.io-redis';
import * as config from '../config.js';
import printLogs from 'rili-public-library/utilities/print-logs'; // tslint:disable-line no-implicit-dependencies

const shouldIncludeLogs = process.argv[2] === 'withLogs';
const shouldIncludeRedisLogs = process.argv[2] === 'withAllLogs' || process.argv[2] === 'withRedisLogs';

const nodes = [
    // Pub
    {
        host: config[process.env.NODE_ENV].redisHost,
        port: config[process.env.NODE_ENV].redisPubPort
    },
    // Sub
    {
        host: config[process.env.NODE_ENV].redisHost,
        port: config[process.env.NODE_ENV].redisSubPort
    },
];

// TODO: RSERV-6: Configure redis clusters
// NOTE: Redis cluster only works on Docker for Linux (ie. Ubuntu) using the host network (https://docs.docker.com/network/host/)
// const redisPubCluster = new Redis.Cluster(nodes);
// const redisSubCluster = new Redis.Cluster(nodes);

const redisPub = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketPub',
    lazyConnect: true,
});

// TODO: RSERV-5: PubSub doesn't seem to work when on different ports
// This might simply require redis clusters
const redisSub = new Redis(nodes[0].port, nodes[0].host, {
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
    let server = app.listen(config[process.env.NODE_ENV].socketPort);
    let io = socketio(server);

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
        printLogs(shouldIncludeRedisLogs, 'REDIS_SUB_CLIENT', null, `Message from channel ${channel}: ${message}`); // tslint:disable-line
    });

    io.on('connection', (socket: any) => {
        printLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', null, 'NEW CONNECTION...');
        socket.on('room.join', (details: any) => {
            // Leave all current rooms (except default room) before joining a new one
            Object.keys(socket.rooms)
                .filter((room) => room !== socket.id)
                .forEach((room) => {
                    socket.broadcast.to(room).emit('event', `${details.userName} left the room`);
                    socket.leave(room);
                });

            setTimeout(() => {
                socket.join(details.roomName, () => {
                    // TODO: Store the user ID in redis with a username to be used while socket is disconnecting
                    printLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', null, `User, ${details.userName} with socketId ${socket.id}, joined room ${details.roomName}`);
                    printLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', null, `${details.userName}'s Current Rooms: ${JSON.stringify(socket.rooms)}`);
                });
                // Emits an event back to the client who joined
                socket.emit('event', `You joined room ${details.roomName}`);
                // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
                socket.broadcast.to(details.roomName).emit('event', `${details.userName} joined room ${details.roomName}`);
            }, 0);
        });

        socket.on('event', (event: any) => {
            printLogs(shouldIncludeLogs, 'EVENT', null, event);
            if (event.message) {
                socket.emit('message', `You: ${event.message}`);
                socket.broadcast.to(event.roomName).emit('message', `${event.userName}: ${event.message}`);
                printLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', null, `${event.userName} said: ${event.message}`);
            } else {
                // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
                socket.emit('message', `You said hello.`);
                socket.broadcast.to(event.roomName).emit('message', `${event.userName} says hello!`);
                printLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', null, `${event.userName} says hello!`);
            }
        });

        socket.on('disconnecting', (reason: string) => {
            // TODO: Use the socket ID to retrieve the username from redis
            printLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', null, `DISCONNECTING... ${reason}`);
            Object.keys(socket.rooms)
                .forEach((room) => {
                    socket.broadcast.to(room).emit('event', `Someone left the room`);
                });
        });
    });
};
