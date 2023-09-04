import opentelemetry from '@opentelemetry/api';
import { LogLevelMap, ILogLevel } from './constants';

interface IPrintLogsArgs {
    level: ILogLevel;
    messageOrigin: string;
    time?: Date | number;
    messages: (number | string) | (number | string)[];
    traceArgs?: { [key: string]: any };
}

/**
 * logOrUpdateSpan
 * @param messageOrigin: string - a title or group descriptor of the message
 * @param time: number - time to display. if 0, don't display time
 * @param messages: (number|string))[] - n number of messages to log
 */
const logOrUpdateSpan = ({
    level,
    messageOrigin,
    time,
    messages,
    traceArgs = {},
}: IPrintLogsArgs) => {
    if (LogLevelMap[level] <= (Number(process.env.LOG_LEVEL) || 2)) { // Default to 'info'
        const activeSpan = opentelemetry.trace.getActiveSpan();

        if (activeSpan) {
            activeSpan?.setAttribute('level', level);
            activeSpan?.setAttribute('message.origin', messageOrigin);
            activeSpan?.setAttribute('message.messages', messages.toString());
            Object.keys(traceArgs).forEach((key) => {
                activeSpan?.setAttribute(key, traceArgs[key]);
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
    }
};

export default logOrUpdateSpan;
