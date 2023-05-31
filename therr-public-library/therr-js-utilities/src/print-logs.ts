import { Beeline, Configure } from 'honeycomb-beeline'; // eslint-disable-line import/newline-after-import
import { LogLevelMap, ILogLevel } from './constants';

interface IPrintLogsArgs {
    level: ILogLevel;
    messageOrigin: string;
    time?: Date | number;
    messages: (number | string) | (number | string)[];
    tracer?: Beeline & Configure;
    traceArgs?: { [key: string]: any };
}

/**
 * printLogs
 * @param messageOrigin: string - a title or group descriptor of the message
 * @param time: number - time to display. if 0, don't display time
 * @param messages: (number|string))[] - n number of messages to log
 */
const printLogs = ({
    level,
    messageOrigin,
    time,
    messages,
    tracer,
    traceArgs = {},
}: IPrintLogsArgs) => {
    if (LogLevelMap[level] <= (Number(process.env.LOG_LEVEL) || 2)) { // Default to 'info'
        let trace;
        if (tracer) {
            if (!tracer.traceActive()) {
                trace = tracer.startTrace();
            }

            tracer.addContext({
                level,
                messageOrigin,
                messages,
                ...traceArgs,
            });
        }
        const includeTime = time !== 0;
        const currentTime = includeTime ? `<at:${time || new Date()}>` : '';
        const messageList = Array.isArray(messages) ? messages : [messages];
        for (let i = 0; i < messageList.length; i += 1) {
            if (messageOrigin) {
                console.info(`${messageOrigin}${currentTime}:`, messageList[i]); // eslint-disable-line no-console
            } else {
                console.info(`LOG${currentTime}:`, messageList[i]); // eslint-disable-line no-console
            }
        }

        if (tracer) {
            tracer.finishTrace(trace);
        }
    }
};

export default printLogs;
