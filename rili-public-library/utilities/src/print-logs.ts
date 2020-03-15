interface IPrintLogsArgs {
    shouldPrintLogs: boolean;
    messageOrigin: string;
    time?: Date | number;
    messages: (number | string) | (number | string)[];
}

/**
 * printLogs
 * @param shouldPrintLogs: boolean - whether or not to actually console messages
 * @param messageOrigin: string - a title or group descriptor of the message
 * @param time: number - time to display. if 0, don't display time
 * @param messages: (number|string))[] - n number of messages to log
 */
const printLogs = (args: IPrintLogsArgs) => {
    if (args.shouldPrintLogs) {
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
