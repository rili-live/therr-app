import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { IUserState, UserActionTypes } from '../../types/redux/user';

const initialState: IUserState = Immutable.from({
    achievements: {},
    details: null,
    settings: {
        locale: 'en-us',
        mobileThemeName: 'retro',
    },
    socketDetails: {},
    isAuthenticated: false,
    userInView: null,
});

const getUserReducer = (socketIO) => (state: IUserState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const actionData = { ...action.data };
    const modifiedAchievements = { ...state.achievements };

    switch (action.type) {
        case UserActionTypes.GET_MY_ACHIEVEMENTS:
            return state.setIn(['achievements'], action.data);
        case UserActionTypes.UPDATE_MY_ACHIEVEMENTS:
            if (modifiedAchievements[action.data.id]) {
                modifiedAchievements[action.data.id] = action.data;
            }
            return state.setIn(['achievements'], modifiedAchievements);
        case SocketServerActionTypes.JOINED_ROOM:
            return state
                .setIn(['socketDetails', 'currentRoom'], action.data.roomId);
        // case SocketServerActionTypes.USER_LOGIN_SUCCESS:
        //     return state.setIn(['socketDetails', 'userName'], action.data.userName);
        // case SocketServerActionTypes.USER_LOGOUT_SUCCESS:
        //     return state.setIn(['socketDetails', 'userName'], null);
        case UserActionTypes.LOGIN:
            return state.setIn(['details'], action.data)
                .setIn(['isAuthenticated'], true);
        case UserActionTypes.GET_USER:
            return state.setIn(['userInView'], action.data);
        case UserActionTypes.UPDATE_USER_IN_VIEW:
            return state.setIn(['userInView'], {
                ...state.userInView,
                ...action.data,
            });
        case SocketServerActionTypes.SESSION_CREATED:
        case SocketServerActionTypes.SESSION_UPDATED:
            return state.setIn(['socketDetails', 'session'], (actionData && actionData.data) || {});
        case SocketServerActionTypes.SESSION_CLOSED:
            socketIO.disconnect();
            return state.setIn(['socketDetails', 'session'], {});
        case SocketClientActionTypes.UPDATE_USER:
            return state.setIn(['details'], {
                ...state.details,
                ...action.data.details,
            }).setIn(['settings'], {
                ...state.settings,
                ...action.data.settings,
            });
        case UserActionTypes.UPDATE_USER_TOUR:
            return state.setIn(['settings'], {
                ...state.settings,
                ...action.data,
            });
        case UserActionTypes.UPDATE_USER_FTUI:
            return state.setIn(['settings'], {
                ...state.settings,
                ...action.data,
            });
        case UserActionTypes.UPDATE_USER_POINTS:
            return state
                .setIn(['details'], {
                    ...state.details,
                    settingsTherrCoinTotal: parseFloat(state.details.settingsTherrCoinTotal)
                        + parseFloat(action.data.settingsTherrCoinTotal),
                }).setIn(['settings'], {
                    ...state.settings,
                    settingsTherrCoinTotal: parseFloat(state.settings.settingsTherrCoinTotal)
                        + parseFloat(action.data.settingsTherrCoinTotal),
                });
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['isAuthenticated'], false)
                .setIn(['socketDetails'], {})
                .setIn(['details'], { id: state.details.id, userName: state.details.userName, media: state.details.media });
        default:
            return state;
    }
};

export default getUserReducer;
