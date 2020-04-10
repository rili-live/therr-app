import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';

const Socket = {
    joinRoom: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.JOIN_ROOM,
            data,
        });
    },
    sendMessage: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.SEND_MESSAGE,
            data,
        });
    },
};

export default Socket;
