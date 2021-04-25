import axios, { AxiosRequestConfig } from 'axios';
import { Socket } from 'socket.io';

interface IDecodedUserToken {
    locale: string;
    userId: string;
}

export default (config: AxiosRequestConfig, socket: Socket, decodedAuthenticationToken: IDecodedUserToken) => axios({
    headers: {
        authorization: `Bearer ${(socket.handshake.query as any).token}`,
        'x-localecode': (socket.handshake.query as any).localeCode || decodedAuthenticationToken.locale || 'en-us',
        'x-userid': decodedAuthenticationToken.userId || '',
    },
    ...config,
});
