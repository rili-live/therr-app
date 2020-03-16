import { LogLevelMap, ILogLevel } from './constants';

interface IPrintLogsArgs {
    level: ILogLevel;
    messageOrigin: string;
    time?: Date | number;
    messages: (number | string) | (number | string)[];
}

/**
 * printLogs
 * @param messageOrigin: string - a title or group descriptor of the message
 * @param time: number - time to display. if 0, don't display time
 * @param messages: (number|string))[] - n number of messages to log
 */
const printLogs = (args: IPrintLogsArgs) => {
    if (LogLevelMap[args.level] <= (Number(process.env.LOG_LEVEL) || 2)) { // Default to 'info'
        const includeTime = args.time !== 0;
        const currentTime = includeTime ? `<at:${args.time || new Date()}>` : '';
        const messageList = Array.isArray(args.messages) ? args.messages : [args.messages];
        for (let i = 0; i < messageList.length; i += 1) {
            if (args.messageOrigin) {
                console.info(`${args.messageOrigin}${currentTime}:`, messageList[i]); // eslint-disable-line no-console
            } else {
                console.info(`LOG${currentTime}:`, messageList[i]); // eslint-disable-line no-console
            }
        }
    }
};

export default printLogs;
