import axios, { AxiosHeaders, AxiosRequestConfig, RawAxiosRequestHeaders } from 'axios';

interface InternalConfigHeaders {
    authorization?: string;
    'x-platform': string;
    'x-brand-variation': string;
    'x-therr-origin-host': string;
    'x-localecode': string;
    'x-requestid'?: string;
    'x-user-device-token'?: string;
    'x-userid'?: string;
    'x-username'?: string;
}

interface IInternalConfig {
    headers: InternalConfigHeaders;
}

const internalRestRequest = (internalConfig: IInternalConfig, axiosConfig: AxiosRequestConfig<any>) => axios({
    ...axiosConfig,
    headers: {
        ...axiosConfig.headers,
        ...internalConfig.headers,
    },
});

export {
    internalRestRequest,
    IInternalConfig,
    InternalConfigHeaders,
};
