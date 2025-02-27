import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { IUserState, UserActionTypes } from '../../types/redux/user';
import { ForumActionTypes } from '../../types';

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
    thoughts: Immutable.from([]),
    myThoughts: Immutable.from([]),
    users: Immutable.from({}),
    usersMightKnow: Immutable.from({}),
    influencerPairings: Immutable.from({}),
    myUserGroups: Immutable.from({}),
});

const getUserReducer = (socketIO) => (state: IUserState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    // Slice to keep total from overflowing
    const modifiedUsers = Object.entries(state.users || {}).slice(0, 100).reduce((acc, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedMightKnowUsers = Object.entries(state.usersMightKnow || {}).slice(0, 100).reduce((acc, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedInfluencerPairings = Object.entries(state.influencerPairings || {}).slice(0, 100).reduce((acc, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedMyUserGroups = Object.entries(state.myUserGroups || {}).slice(0, 100).reduce((acc, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});

    const actionData = { ...action.data };
    const modifiedAchievements = { ...state.achievements };
    const modifiedThought = [...(state.thoughts || [])];
    let modifiedMyThought = [...(state.myThoughts || [])];

    switch (action.type) {
        case UserActionTypes.GET_USERS:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['users'], action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedUsers))
                .setIn(['usersMightKnow'], action.data?.mightKnowResults?.reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), {}));
        case UserActionTypes.GET_USERS_REFETCH:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['users'], action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), {})); // Clear stale results
        case UserActionTypes.GET_USERS_UPDATE:
            if (modifiedUsers[action.data.id]) {
                modifiedUsers[action.data.id] = {
                    ...modifiedUsers[action.data.id],
                    ...action.data.updates,
                };
            }
            if (modifiedMightKnowUsers[action.data.id]) {
                modifiedMightKnowUsers[action.data.id] = {
                    ...modifiedMightKnowUsers[action.data.id],
                    ...action.data.updates,
                };
            }
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['users'], modifiedUsers).setIn(['usersMightKnow'], modifiedMightKnowUsers); // Clear stale results
        case UserActionTypes.GET_USERS_PAIRINGS:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['influencerPairings'], action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedInfluencerPairings));
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
            // Retains existing settings with overwrite
            return state.setIn(['details'], {
                ...state.details,
                ...action.data.details,
            }).setIn(['settings'], {
                ...state.settings,
                ...action.data.settings,
            });
        case SocketClientActionTypes.RESET_USER_SETTINGS:
            // Clears our existing settings
            return state.setIn(['settings'], {
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

        // THOUGHTS //
        case UserActionTypes.GET_THOUGHTS:
            return state.setIn(['thoughts'], action.data.results);
        case UserActionTypes.GET_THOUGHT_DETAILS:
            modifiedThought.some((thought, index) => { // eslint-disable-line no-case-declarations
                if (thought.id === action.data.thought?.id) {
                    modifiedThought[index] = {
                        ...thought,
                        ...action.data.thought,
                    };
                    return true;
                }

                return false;
            });
            return state.setIn(['thoughts'], modifiedThought);
        case UserActionTypes.GET_MY_THOUGHTS:
            return state.setIn(['myThoughts'], action.data.results);
        case UserActionTypes.THOUGHT_CREATED:
            modifiedMyThought.unshift(action.data);
            return state.setIn(['myThoughts'], modifiedMyThought);
            // case UserActionTypes.THOUGHT_UPDATED:
            //     modifiedMyThought.some((thought, index) => {
            //         if (thought.id === action.data.id) {
            //             modifiedMyThought[index] = {
            //                 ...thought,
            //                 ...action.data,
            //             };
            //             return true;
            //         }

            //         return false;
            //     });
            //     return state.setIn(['myThoughts'], modifiedMyThought);
        case UserActionTypes.THOUGHT_DELETED:
            modifiedMyThought = state.myThoughts.filter((thought) => { // eslint-disable-line no-case-declarations
                if (!action.data || !action.data.ids) {
                    return true;
                }
                return !action.data.ids.includes(thought.id);
            });
            return state.setIn(['myThoughts'], modifiedMyThought);
        case UserActionTypes.GET_USER_GROUPS:
            return state.setIn(['myUserGroups'], action.data.userGroups
                .reduce((acc, item) => ({
                    ...acc,
                    [item.groupId]: item,
                }), modifiedMyUserGroups));
        case ForumActionTypes.CREATE_FORUM:
            if (action.data?.userGroup) {
                modifiedMyUserGroups[action.data?.userGroup.groupId] = action.data?.userGroup;
            }
            return state.setIn(['myUserGroups'], modifiedMyUserGroups);
        case UserActionTypes.USER_GROUP_CREATED:
            modifiedMyUserGroups[action.data.groupId] = action.data;
            return state.setIn(['myUserGroups'], modifiedMyUserGroups);
        case UserActionTypes.USER_GROUP_DELETED:
            delete modifiedMyUserGroups[action.data.groupId];
            return state.setIn(['myUserGroups'], modifiedMyUserGroups);
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['isAuthenticated'], false)
                .setIn(['socketDetails'], {})
                .setIn(['myUserGroups'], {})
                .setIn(['users'], {})
                .setIn(['usersMightKnow'], {})
                .setIn(['details'], { id: state.details.id, userName: state.details.userName, media: state.details.media });
        default:
            return state;
    }
};

export default getUserReducer;
