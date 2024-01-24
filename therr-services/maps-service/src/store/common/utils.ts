export const sanitizeNotificationMsg = (message = '') => message.replace(/\r?\n+|\r+/gm, ' ');
