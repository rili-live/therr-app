import { produce } from 'immer';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { IUserState, UserActionTypes } from '../../types/redux/user';
import { ForumActionTypes } from '../../types';

const initialState: IUserState = {
    achievements: {},
    details: null,
    settings: {
        locale: 'en-us',
        mobileThemeName: 'light',
    },
    socketDetails: {},
    isAuthenticated: false,
    userInView: null,
    thoughts: [],
    myThoughts: [],
    users: {},
    usersMightKnow: {},
    influencerPairings: {},
    myUserGroups: {},
};

const getUserReducer = (socketIO) => produce((draft: IUserState, action: any) => {
    // Slice to keep total from overflowing
    const modifiedUsers: { [key: string]: any } = Object.entries(draft.users || {}).slice(0, 100).reduce((acc: { [key: string]: any }, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedMightKnowUsers: { [key: string]: any } = Object.entries(draft.usersMightKnow || {}).slice(0, 100).reduce((acc: { [key: string]: any }, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedInfluencerPairings: { [key: string]: any } = Object.entries(draft.influencerPairings || {}).slice(0, 100).reduce((acc: { [key: string]: any }, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedMyUserGroups: { [key: string]: any } = Object.entries(draft.myUserGroups || {}).slice(0, 100).reduce((acc: { [key: string]: any }, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});

    const actionData = { ...action.data };
    const modifiedAchievements = { ...draft.achievements };

    switch (action.type) {
        case UserActionTypes.GET_USERS:
            // Convert array to object for faster lookup and de-duping
            draft.users = action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedUsers);
            draft.usersMightKnow = action.data?.mightKnowResults?.reduce((acc, item) => ({
                ...acc,
                [item.id]: item,
            }), {});
            break;
        case UserActionTypes.GET_USERS_REFETCH:
            // Convert array to object for faster lookup and de-duping
            draft.users = action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), {}); // Clear stale results
            break;
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
            draft.users = modifiedUsers;
            draft.usersMightKnow = modifiedMightKnowUsers; // Clear stale results
            break;
        case UserActionTypes.GET_USERS_PAIRINGS:
            // Convert array to object for faster lookup and de-duping
            draft.influencerPairings = action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedInfluencerPairings);
            break;
        case UserActionTypes.GET_MY_ACHIEVEMENTS:
            draft.achievements = action.data;
            break;
        case UserActionTypes.UPDATE_MY_ACHIEVEMENTS:
            if (modifiedAchievements[action.data.id]) {
                modifiedAchievements[action.data.id] = action.data;
            }
            draft.achievements = modifiedAchievements;
            break;
        case SocketServerActionTypes.JOINED_ROOM:
            draft.socketDetails.currentRoom = action.data.roomId;
            break;
        // case SocketServerActionTypes.USER_LOGIN_SUCCESS:
        //     draft.socketDetails.userName = action.data.userName;
        //     break;
        // case SocketServerActionTypes.USER_LOGOUT_SUCCESS:
        //     draft.socketDetails.userName = null;
        //     break;
        case UserActionTypes.LOGIN:
            draft.details = action.data;
            draft.isAuthenticated = true;
            break;
        case UserActionTypes.GET_USER:
            draft.userInView = action.data;
            break;
        case UserActionTypes.UPDATE_USER_IN_VIEW:
            draft.userInView = {
                ...draft.userInView,
                ...action.data,
            };
            break;
        case SocketServerActionTypes.SESSION_CREATED:
        case SocketServerActionTypes.SESSION_UPDATED:
            draft.socketDetails.session = (actionData && actionData.data) || {};
            break;
        case SocketServerActionTypes.SESSION_CLOSED:
            socketIO.disconnect();
            draft.socketDetails.session = {};
            break;
        case SocketClientActionTypes.UPDATE_USER:
            // Retains existing settings with overwrite
            draft.details = {
                ...draft.details,
                ...action.data.details,
            };
            draft.settings = {
                ...draft.settings,
                ...action.data.settings,
            };
            break;
        case SocketClientActionTypes.RESET_USER_SETTINGS:
            // Clears our existing settings
            draft.settings = {
                ...action.data.settings,
            };
            break;
        case UserActionTypes.UPDATE_USER_TOUR:
            draft.settings = {
                ...draft.settings,
                ...action.data,
            };
            break;
        case UserActionTypes.UPDATE_USER_FTUI:
            draft.settings = {
                ...draft.settings,
                ...action.data,
            };
            break;
        case UserActionTypes.UPDATE_USER_POINTS:
            draft.details = {
                ...draft.details,
                settingsTherrCoinTotal: parseFloat(draft.details.settingsTherrCoinTotal)
                    + parseFloat(action.data.settingsTherrCoinTotal),
            };
            draft.settings = {
                ...draft.settings,
                settingsTherrCoinTotal: parseFloat(draft.settings.settingsTherrCoinTotal)
                    + parseFloat(action.data.settingsTherrCoinTotal),
            };
            break;

        // THOUGHTS //
        case UserActionTypes.GET_THOUGHTS:
            draft.thoughts = action.data.results;
            break;
        case UserActionTypes.GET_THOUGHT_DETAILS: {
            const idx = draft.thoughts.findIndex((t) => t.id === action.data.thought?.id);
            if (idx !== -1) {
                draft.thoughts[idx] = {
                    ...draft.thoughts[idx],
                    ...action.data.thought,
                };
            }
            break;
        }
        case UserActionTypes.GET_MY_THOUGHTS:
            draft.myThoughts = action.data.results;
            break;
        case UserActionTypes.THOUGHT_CREATED:
            draft.myThoughts.unshift(action.data);
            break;
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
            //     draft.myThoughts = modifiedMyThought;
            //     break;
        case UserActionTypes.THOUGHT_DELETED:
            draft.myThoughts = draft.myThoughts.filter((thought) => {
                if (!action.data || !action.data.ids) {
                    return true;
                }
                return !action.data.ids.includes(thought.id);
            });
            break;
        case UserActionTypes.GET_USER_GROUPS:
            draft.myUserGroups = action.data.userGroups
                .reduce((acc, item) => ({
                    ...acc,
                    [item.groupId]: item,
                }), modifiedMyUserGroups);
            break;
        case ForumActionTypes.CREATE_FORUM:
            if (action.data?.userGroup) {
                modifiedMyUserGroups[action.data?.userGroup.groupId] = action.data?.userGroup;
            }
            draft.myUserGroups = modifiedMyUserGroups;
            break;
        case UserActionTypes.USER_GROUP_CREATED:
            modifiedMyUserGroups[action.data.groupId] = action.data;
            draft.myUserGroups = modifiedMyUserGroups;
            break;
        case UserActionTypes.USER_GROUP_DELETED:
            delete modifiedMyUserGroups[action.data.groupId];
            draft.myUserGroups = modifiedMyUserGroups;
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.isAuthenticated = false;
            draft.socketDetails = {};
            draft.myUserGroups = {};
            draft.users = {};
            draft.usersMightKnow = {};
            draft.details = { id: draft.details.id, userName: draft.details.userName, media: draft.details.media } as any;
            break;
        default:
            break;
    }
}, initialState);

export default getUserReducer;
