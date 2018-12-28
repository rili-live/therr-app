/**
 * printLogs
 * @param shouldShowLogs: boolean - whether or not to actually console messages
 * @param messageOrigin: string - a title or group descriptor of the message
 * @param time: number - time to display. if 0, don't display time
 * @param messages: any[] - n number of messages to log
 */
const printLogs = (shouldShowLogs: boolean, messageOrigin: string, time: number, ...messages: any[]) => {
    if (shouldShowLogs) {
        const includeTime = time !== 0;
        const currentTime = includeTime ? `<at:${time || Date.now()}>` : '';
        for (let i = 0; i < messages.length; i++) {
            if (messageOrigin) {
                console.info(`${messageOrigin}${currentTime}:`, messages[i]); // tslint:disable-line no-console
            } else {
                console.info(`LOG${currentTime}:`, messages[i]); // tslint:disable-line no-console
            }
        }
        return;
    }
};

export default printLogs;
