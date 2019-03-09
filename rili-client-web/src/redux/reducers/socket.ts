import * as Immutable from 'seamless-immutable';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants';

type IRoomsArray = Immutable.ImmutableArray<any>;

export interface ISocketState extends Immutable.ImmutableObject<any> {
    currentRoom: String;
    rooms: IRoomsArray;
    messages: any;
}

const initialState: ISocketState = Immutable.from({
    currentRoom: '',
    rooms: [],
    messages: {}
});

const socket = (state: ISocketState = initialState, action: any) => {
    console.log('ACTION', action); // tslint:disable-line
    switch (action.type) {
        // Any time this action is called, the data will be a full room list from the server
        case SocketServerActionTypes.SEND_ROOMS_LIST:
            return initialState.setIn(['rooms'], action.data);
        case SocketServerActionTypes.JOINED_ROOM:
        case SocketServerActionTypes.SEND_MESSAGE:
            const prevMessageList = state.messages[action.data.roomId] || [];
            const incomingMessageList = [action.data].concat(prevMessageList);
            const nextState = initialState.setIn(['currentRoom'], action.data.roomId);

            return nextState.setIn(['messages', action.data.roomId], incomingMessageList);
        default:
            return state;
    }
};

export default socket;