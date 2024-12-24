import axios, { AxiosRequestConfig } from 'axios';

interface InternalConfigHeaders {
    authorization?: string;
    'x-platform': string;
    'x-brand-variation': string;
    'x-therr-origin-host'?: string;
    'x-localecode': string;
    'x-requestid'?: string;
    'x-user-device-token'?: string;
    'x-user-access-levels'?: string;
    'x-userid'?: string;
    'x-username'?: string;
}

interface IInternalConfig {
    headers: InternalConfigHeaders;
}

const validInternalHeaders = [
    'authorization',
    'x-platform',
    'x-brand-variation',
    'x-therr-origin-host',
    'x-localecode',
    'x-requestid',
    'x-user-device-token',
    'x-user-access-levels',
    'x-userid',
    'x-username',
];

const internalRestRequest = (internalConfig: IInternalConfig, axiosConfig: AxiosRequestConfig<any>) => {
    const sanitizedInternalConfigHeaders: any = {};
    Object.keys(internalConfig.headers || {})
        .filter((header) => validInternalHeaders.includes(header))
        .forEach((header) => {
            sanitizedInternalConfigHeaders[header] = (internalConfig.headers as any)?.[header];
        });
    return axios({
        ...axiosConfig,
        headers: {
            ...axiosConfig.headers,
            ...sanitizedInternalConfigHeaders,
        },
    });
};

export {
    internalRestRequest,
    IInternalConfig,
    InternalConfigHeaders,
};
