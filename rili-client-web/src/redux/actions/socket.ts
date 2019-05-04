import { SocketClientActionTypes } from 'rili-public-library/utilities/constants';

const SocketActions = {
    joinRoom: (data: any) => {
        return (dispatch: any) => {
            dispatch({
                'type': SocketClientActionTypes.JOIN_ROOM,
                'data': data
            });
        };
    },
    login: (data: any) => {
        return (dispatch: any) => {
            dispatch({
                'type': SocketClientActionTypes.LOGIN,
                'data': data
            });
        };
    },
    sendMessage: (data: any) => {
        return (dispatch: any) => {
            dispatch({
                'type': SocketClientActionTypes.SEND_MESSAGE,
                'data': data
            });
        };
    },
};

export default SocketActions;
