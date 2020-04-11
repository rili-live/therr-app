import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';

const Socket = {
    refreshConnection: (data) => (dispatch) => {
        dispatch({
            type: SocketClientActionTypes.UPDATE_SESSION,
            data,
        });
    },
    joinRoom: (data) => (dispatch) => {
        dispatch({
            type: SocketClientActionTypes.JOIN_ROOM,
            data,
        });
    },
    sendMessage: (data) => (dispatch) => {
        dispatch({
            type: SocketClientActionTypes.SEND_MESSAGE,
            data,
        });
    },
};

export default Socket;
