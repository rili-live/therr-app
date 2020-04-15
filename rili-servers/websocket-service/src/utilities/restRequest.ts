import printLogs from 'rili-public-library/utilities/print-logs.js';
import axios, { AxiosRequestConfig } from 'axios';
import beeline from '../beeline';

export default (config: AxiosRequestConfig, socket: SocketIO.Socket) => {
    printLogs({
        level: 'debug',
        messageOrigin: 'SOCKET_REST_REQUEST',
        messages: [socket.handshake.toString()],
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
            socketHandshake: socket.handshake.toString(),
        },
    });
    return axios({
        headers: {
            authorization: `Bearer ${socket.handshake.query.token}`,
            'x-localecode': socket.handshake.query.localeCode || '',
        },
        ...config,
    });
};
