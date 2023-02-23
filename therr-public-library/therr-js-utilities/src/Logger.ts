import axios from 'axios';
// import { LogLevelMap, ILogLevel } from './constants';

export default class Logger {
    private defaultNamespace: string;

    private defaultHeaders: any = {};

    constructor(args: any) {
        this.defaultNamespace = args.namespace || process.env.LOGGING_DATASET || 'development';
        this.defaultHeaders['X-Honeycomb-Team'] = process.env.HONEYCOMB_API_KEY;
    }

    log = (data: any | any[], namespace?: any, headers: any = {}, endpoint = '/events/') => {
        const formattedData = data;
        return this.sendLog(formattedData, namespace, headers, endpoint);
    };

    sendLog = (data: any | any[], namespace?: any, headers: any = {}, endpoint = '/events/') => {
        if (!headers['X-Honeycomb-Event-Time']) {
            headers['X-Honeycomb-Event-Time'] = new Date(); // eslint-disable-line no-param-reassign
        }

        const sanitizedData = data;

        return axios({
            method: 'post',
            url: `https://api.honeycomb.io/1${endpoint}${namespace || this.defaultNamespace}`,
            data: JSON.stringify(sanitizedData),
            headers: {
                ...this.defaultHeaders,
                ...headers,
            },
        }).catch((e) => {
            if (e) {
                if (e.data) {
                    console.warn(e.data);
                } else if (e.message) {
                    console.warn(e.message);
                } else {
                    console.warn(e);
                }
            }
        });
    };
}
