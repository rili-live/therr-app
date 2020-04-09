import joinRoom from './rooms';
import login from './login';
import logout from './logout';
import sendMessage from './messages';
import updateNotification from './notifications';
import { createConnection, updateConnection } from './userConnections';

export {
    // Auth
    login,
    logout,

    // Rooms
    joinRoom,

    // Messages
    sendMessage,

    // Notifications
    updateNotification,

    // Connections
    createConnection,
    updateConnection,
};
