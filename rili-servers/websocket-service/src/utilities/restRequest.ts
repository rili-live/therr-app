import axios, { AxiosRequestConfig } from 'axios';

export default (config: AxiosRequestConfig, socket: SocketIO.Socket) => axios({
    headers: {
        authorization: `Bearer ${socket.handshake.query.token}`,
        'x-localecode': socket.handshake.query.localeCode || '',
    },
    ...config,
});
