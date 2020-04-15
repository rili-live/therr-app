import printLogs from 'rili-public-library/utilities/print-logs.js';
import axios, { AxiosRequestConfig } from 'axios';
import beeline from '../beeline';

export default (config: AxiosRequestConfig, socket: SocketIO.Socket) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_REST_REQUEST',
        messages: 'Socket REST request debug',
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
            socketHandshake: JSON.stringify(socket.handshake),
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
