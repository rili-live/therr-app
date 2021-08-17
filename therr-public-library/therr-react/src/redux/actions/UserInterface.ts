import { UserInterfaceActionTypes } from '../../types/redux/userInterface';

const UserInterface = {
    captureClickEvent: (eventTarget: any) => (dispatch: any) => {
        dispatch({
            type: UserInterfaceActionTypes.UPDATE_CLICK_TARGET,
            data: eventTarget,
        });
    },
};

export default UserInterface;
