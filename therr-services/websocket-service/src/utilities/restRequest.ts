import axios, { AxiosRequestConfig } from 'axios';
import { Socket } from 'socket.io';

interface IDecodedUserToken {
    id: number,
    userName: string,
    email: string,
    phoneNumber: string,
    isSSO: boolean,
    iat: number,
    exp: number,
    locale: string;
  }

export default (config: AxiosRequestConfig, socket: Socket, decodedAuthenticationToken: IDecodedUserToken) => axios({
    headers: {
        authorization: `Bearer ${(socket.handshake.query as any).token}`,
        'x-localecode': (socket.handshake.query as any).localeCode || decodedAuthenticationToken.locale || 'en-us',
        'x-userid': decodedAuthenticationToken.id || '',
    },
    ...config,
});
