import axios, { AxiosRequestConfig } from 'axios';
import { Socket } from 'socket.io';

export default (config: AxiosRequestConfig, socket: Socket) => axios({
    headers: {
        authorization: `Bearer ${(socket.handshake.query as any).token}`,
        'x-localecode': (socket.handshake.query as any).localeCode || '',
    },
    ...config,
});
