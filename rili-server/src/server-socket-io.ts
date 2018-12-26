import * as express from 'express';
import * as socketio from 'socket.io';
import * as socketioRedis from 'socket.io-redis';
import * as config from '../config.js';

let app = express();
let server = app.listen(config[process.env.NODE_ENV].socketPort);
let io = socketio(server);

io.adapter(socketioRedis({
    host: config[process.env.NODE_ENV].redisHost,
    port: config[process.env.NODE_ENV].redisPort
}));

io.on('connection', (socket: any) => {
    console.log('NEW CONNECTION...'); // tslint:disable-line
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
                console.log(`User, ${details.userName}, joined room ${details.roomName}. SocketId: ${socket.id}, Current Rooms: `, socket.rooms); // tslint:disable-line
            });
            // Emits an event back to the client who joined
            socket.emit('event', `You joined room ${details.roomName}`);
            // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
            socket.broadcast.to(details.roomName).emit('event', `${details.userName} joined room ${details.roomName}`);
        }, 0);
    });

    socket.on('event', (event: any) => {
        // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
        socket.broadcast.to(event.roomName).emit('event', event.userName + ' says hello!');
    });

    socket.on('disconnecting', (reason: string) => {
        // TODO: Use the socket ID to retrieve the username from redis
        console.log('DISCONNECTING...', reason); // tslint:disable-line
        console.log(socket); // tslint:disable-line
        Object.keys(socket.rooms)
            .forEach((room) => {
                socket.broadcast.to(room).emit('event', `Someone left the room`);
            });
    });
});
