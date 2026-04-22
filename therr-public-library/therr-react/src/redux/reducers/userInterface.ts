import { produce } from 'immer';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IUserInterfaceState, UserInterfaceActionTypes } from '../../types/redux/userInterface';

const initialState: IUserInterfaceState = {
    details: {
        lastClickedTargetId: '',
    },
};

const userInterface = produce((draft: IUserInterfaceState, action: any) => {
    switch (action.type) {
        case UserInterfaceActionTypes.UPDATE_CLICK_TARGET:
            draft.details = { ...draft.details, lastClickedTargetId: action.data };
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.details = { ...initialState.details };
            break;
        default:
            break;
    }
}, initialState);

export default userInterface;
