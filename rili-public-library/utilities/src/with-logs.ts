/**
 * withLogs
 * @param shouldShowLogs: boolean - whether or not to actually console messages
 * @param messageOrigin: string - a title or group descriptor of the message
 * @param messages: any[] - n number of messages to log
 */
const withLogs = (shouldShowLogs: boolean, messageOrigin: string, ...messages: any[]) => {
    if (shouldShowLogs) {
        for (let i = 0; i < messages.length; i++) {
            if (messageOrigin) {
                console.info(`${messageOrigin}:`, messages[i]); // tslint:disable-line no-console
            } else {
                console.info('LOG:', messages[i]); // tslint:disable-line no-console
            }
        }
        return;
    }
};

export default withLogs;