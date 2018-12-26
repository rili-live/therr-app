import * as express from 'express';
import * as Redis from 'ioredis';
import * as socketio from 'socket.io';
import * as socketioRedis from 'socket.io-redis';
import * as config from '../config.js';
import withLogs from 'rili-public-library/utilities/with-logs'; // tslint:disable-line no-implicit-dependencies

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

// TODO: RSERV-5: Configure redis clusters
// NOTE: Redis cluster only works on Docker for Linux (ie. Ubuntu) using the host network (https://docs.docker.com/network/host/)
// const redisPubCluster = new Redis.Cluster(nodes);
// const redisSubCluster = new Redis.Cluster(nodes);
// EXAMPLE OF PUB/SUB
// redisSubCluster.on('message', function (channel, message) {
//     withLogs(shouldIncludeRedisLogs, 'SAMPLE_PUB_SUB' channel, message);
// });

// redisSubCluster.subscribe('news', function () {
//     redisPubCluster.publish('news', 'highlights');
// });

const redisPub = new Redis(nodes[0].port, nodes[0].host, {
    lazyConnect: true,
});

const redisSub = new Redis(nodes[1].port, nodes[1].host, {
    lazyConnect: true,
});

// We must connect manually since lazyConnect is true
const redisConnectPromises = [redisPub.connect(), redisSub.connect()];

Promise.all(redisConnectPromises).then((responses: any[]) => {
    // connection ready
    if (shouldIncludeRedisLogs) {
        redisPub.monitor().then(function (monitor) {
            monitor.on('monitor', function (time, args, source, database) {
                withLogs(true, `REDIS_PUB_LOG<time:${time}>`, `Source: ${source}, Database: ${database}`, ...args);
            });
        });
        redisSub.monitor().then(function (monitor) {
            monitor.on('monitor', function (time, args, source, database) {
                withLogs(true, `REDIS_SUB_LOG<time:${time}>`, `Source: ${source}, Database: ${database}`, ...args);
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
    //     withLogs(shouldIncludeRedisLogs, 'REDIS_PUB_CLUSTER_CONNECTION_ERROR:', error);
    // });
    // redisSubCluster.on('error', (error: string) => {
    //     withLogs(shouldIncludeRedisLogs, 'REDIS_SUB_CLUSTER_CONNECTION_ERROR:', error);
    // });
    // NOTE: These might be the same as the above error handlers
    // redisAdapter.pubClient.on('error', (err: string) => {
    //     withLogs(shouldIncludeRedisLogs, 'PUB_CLIENT_ERROR: ', err);
    // });
    // redisAdapter.subClient.on('error', (err: string) => {
    //     withLogs(shouldIncludeRedisLogs, 'SUB_CLIENT_ERROR: ', err);
    // });

    io.on('connection', (socket: any) => {
        withLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', 'NEW CONNECTION...');
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
                    withLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', `User, ${details.userName} with socketId ${socket.id}, joined room ${details.roomName}`);
                    withLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', `${details.userName}'s Current Rooms: `, socket.rooms);
                });
                // Emits an event back to the client who joined
                socket.emit('event', `You joined room ${details.roomName}`);
                // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
                socket.broadcast.to(details.roomName).emit('event', `${details.userName} joined room ${details.roomName}`);
            }, 0);
        });

        socket.on('event', (event: any) => {
            if (event.message) {
                socket.emit('message', `You: ${event.message}`);
                socket.broadcast.to(event.roomName).emit('message', `${event.userName}: ${event.message}`);
            } else {
                // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
                socket.emit('message', `You said hello.`);
                socket.broadcast.to(event.roomName).emit('message', `${event.userName} says hello!`);
            }
        });

        socket.on('disconnecting', (reason: string) => {
            // TODO: Use the socket ID to retrieve the username from redis
            withLogs(shouldIncludeLogs, 'SOCKET_IO_LOGS', 'DISCONNECTING...', reason);
            Object.keys(socket.rooms)
                .forEach((room) => {
                    socket.broadcast.to(room).emit('event', `Someone left the room`);
                });
        });
    });
};
