import axios, { AxiosRequestConfig } from 'axios';
import { internalRestRequest, IInternalConfig } from 'therr-js-utilities/internal-rest-request';
import { Socket } from 'socket.io';

interface IDecodedUserToken {
    id: string,
    userName: string,
    email: string,
    phoneNumber: string,
    isSSO: boolean,
    iat: number,
    exp: number,
    locale: string;
}

export default (
    internalConfig: IInternalConfig,
    config: AxiosRequestConfig,
    socket: Socket,
    decodedAuthenticationToken: IDecodedUserToken,
) => internalRestRequest({
    headers: {
        ...internalConfig.headers,
        authorization: `Bearer ${(socket.handshake.query as any).token}`,
        'x-userid': decodedAuthenticationToken.id || '',
        'x-localecode': (socket.handshake.query as any).localeCode || decodedAuthenticationToken.locale || 'en-us',
    },
}, {
    ...config,
});
