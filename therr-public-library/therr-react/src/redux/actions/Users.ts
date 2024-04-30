/* eslint-disable class-methods-use-this */
import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IUser, IUserSettings, UserActionTypes } from '../../types/redux/user';
import UsersService, { ISearchUsersArgs, ISocialSyncs } from '../../services/UsersService';
import { ContentActionTypes } from '../../types/redux/content';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ISearchThoughtsArgs {}
interface ILoginSSOTokens {
    google?: string;
}

interface IUpdateTourArgs {
    isTouring: boolean;
}
class UsersActions {
    constructor(socketIO, NativeStorage?, GoogleSignin?) {
        this.socketIO = socketIO;
        this.GoogleSignin = GoogleSignin;
        this.NativeStorage = NativeStorage;
    }

    private socketIO;

    private GoogleSignin;

    private NativeStorage;

    extractUserData = (userResponseData): { userData: IUser, userSettingsData: IUserSettings } => {
        const {
            accessLevels,
            id,
            idToken,
            email,
            firstName,
            lastName,
            phoneNumber,
            userName,
            lastKnownLatitude,
            lastKnownLongitude,
            media,
            rememberMe,
            settingsBio,
            settingsThemeName,
            settingsTherrCoinTotal,
            settingsAreaCoinTotal,
            settingsBirthdate,
            settingsGender,
            settingsLocale,
            settingsWebsite,
            settingsIsProfilePublic,
            settingsPushTopics,
            settingsEmailMarketing,
            settingsEmailBusMarketing,
            settingsEmailBackground,
            settingsEmailInvites,
            settingsEmailLikes,
            settingsEmailMentions,
            settingsEmailMessages,
            settingsEmailReminders,
            settingsPushMarketing,
            settingsPushBackground,
            settingsPushInvites,
            settingsPushLikes,
            settingsPushMentions,
            settingsPushMessages,
            settingsPushReminders,
            integrations,
            loginCount,
            userOrganizations,
        } = userResponseData;
        const mutableUserData: any = {
            accessLevels,
            id,
            email,
            firstName,
            lastName,
            loginCount,
            phoneNumber,
            userName,
            media,
            lastKnownLatitude,
            lastKnownLongitude,
            userOrganizations,
        };
        if (idToken) {
            // Note: CAREFUL! - if this is undefined it could overwrite stored value an trigger user logout in interceptors.ts
            mutableUserData.idToken = idToken;
        }
        const userData: IUser = Immutable.from(mutableUserData);
        // TODO: Get user settings data from db response
        const userSettingsData: IUserSettings = Immutable.from({
            id, // Included because userSettings persists even after logout. This helps prevent cross-user contamination
            userName, // Included because userSettings persists even after logout. This helps prevent cross-user contamination
            locale: 'en-us',
            integrations,
            mobileThemeName: settingsThemeName || 'retro',
            rememberMe,
            settingsBio,
            settingsTherrCoinTotal,
            settingsAreaCoinTotal,
            settingsBirthdate,
            settingsGender,
            settingsLocale,
            settingsWebsite,
            settingsIsProfilePublic,
            settingsPushTopics,
            settingsEmailMarketing,
            settingsEmailBusMarketing,
            settingsEmailBackground,
            settingsEmailInvites,
            settingsEmailLikes,
            settingsEmailMentions,
            settingsEmailMessages,
            settingsEmailReminders,
            settingsPushMarketing,
            settingsPushBackground,
            settingsPushInvites,
            settingsPushLikes,
            settingsPushMentions,
            settingsPushMessages,
            settingsPushReminders,
        });

        return {
            userData,
            userSettingsData,
        };
    };

    block = (userIdToBlock: string, alreadyBlockedUsers: number[]) => (dispatch: any) => UsersService
        .block(userIdToBlock, alreadyBlockedUsers).then(async (response) => {
            const {
                blockedUsers,
            } = response && response.data;
            // TODO: Dispatch event to filter blocked users from content display
            const userDetails = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || {});
            const userData: IUser = Immutable.from({
                ...userDetails,
                ...response.data,
            });
            (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(userData));

            dispatch({
                type: SocketClientActionTypes.UPDATE_USER,
                data: {
                    details: {
                        blockedUsers,
                    },
                },
            });
            return { blockedUsers };
        });

    createUpdateSocialSyncs = (socialSyncs: ISocialSyncs) => (dispatch: any) => UsersService
        .createUpdateSocialSyncs(socialSyncs).then((response) => {
            dispatch({
                type: UserActionTypes.UPDATE_USER_IN_VIEW,
                data: {
                    socialSyncs: response?.data?.syncs,
                },
            });

            return response;
        });

    get = (userId: string) => (dispatch: any) => UsersService.get(userId).then((response) => {
        dispatch({
            type: UserActionTypes.GET_USER,
            data: response?.data,
        });

        return response?.data;
    });

    search = (args: ISearchUsersArgs) => (dispatch: any) => UsersService.search(args).then((response) => {
        if (args.query) {
            dispatch({
                type: UserActionTypes.GET_USERS_REFETCH,
                data: response?.data,
            });
        } else {
            dispatch({
                type: UserActionTypes.GET_USERS,
                data: response?.data,
            });
        }

        return response?.data;
    });

    searchPairings = (args: ISearchUsersArgs) => (dispatch: any) => UsersService.searchPairings(args).then((response) => {
        dispatch({
            type: UserActionTypes.GET_USERS_PAIRINGS,
            data: response?.data,
        });

        return response?.data;
    });

    searchUpdateUser = (userId: string, updates: { isConnected: boolean }) => (dispatch: any) => {
        dispatch({
            type: UserActionTypes.GET_USERS_UPDATE,
            data: {
                id: userId,
                updates,
            },
        });
    };

    updateUserInView = (data: any) => (dispatch: any) => {
        dispatch({
            type: UserActionTypes.UPDATE_USER_IN_VIEW,
            data,
        });
    };

    login = (data: any, idTokens?: ILoginSSOTokens) => async (dispatch: any) => {
        await UsersService.authenticate(data).then(async (response) => {
            const {
                idToken,
            } = response.data;

            const { userData, userSettingsData } = this.extractUserData(response.data);
            this.socketIO.io.opts.query = {
                token: idToken,
            };
            const afterIOConnectAttempt = () => {
                // These two dispatches were moved here to fix a bug when one dispatch happened before the callback
                // For some reason it caused the websocket server to NOT receive the message in the callback.
                // We should also call these regardless when failing to connect to the socket server
                dispatch({
                    type: SocketClientActionTypes.LOGIN,
                    data: userData,
                });
                dispatch({
                    type: UserActionTypes.LOGIN,
                    data: userData,
                });
                dispatch({
                    type: SocketClientActionTypes.RESET_USER_SETTINGS,
                    data: {
                        settings: userSettingsData,
                    },
                });
            };
            // Connect and get socketIO.id
            const onIOConnectListener = async () => {
                const sessionData = { id: this.socketIO.id, idTokens: idTokens || {} };
                // NOTE: Native Storage methods return a promise, but in this case we don't need to await
                await (this.NativeStorage || sessionStorage)
                    .setItem('therrSession', JSON.stringify(sessionData));
                if (data.rememberMe && !this.NativeStorage) {
                    localStorage.setItem('therrSession', JSON.stringify(sessionData));
                }

                afterIOConnectAttempt();
            };
            // TODO: Send event to Google Analytics and/or Datadog
            const onIOConnectErrorListener = (error: any) => {
                // We still need to let the user login when websocket service is down or not available
                console.warn(error);
                afterIOConnectAttempt();
            };
            this.socketIO.on('connect', onIOConnectListener);
            this.socketIO.on('connect_error', onIOConnectErrorListener);
            this.socketIO.connect();
            (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(userData));
            (this.NativeStorage || sessionStorage).setItem('therrUserSettings', JSON.stringify(userSettingsData));
            if (data.rememberMe && !this.NativeStorage) {
                localStorage.setItem('therrUser', JSON.stringify(userData));
                localStorage.setItem('therrUserSettings', JSON.stringify(userSettingsData));
            }
        });
    };

    getMe = () => async (dispatch: any) => {
        await UsersService.getMe().then(async (response) => {
            const localUserDetails = JSON.parse(await (this.NativeStorage || localStorage).getItem('therrUser') || null);
            const sessionUserDetails = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || null);
            const { userData, userSettingsData } = this.extractUserData(response.data);
            const combinedUserDetails = {
                ...localUserDetails,
                ...sessionUserDetails,
                ...userData,
            };
            dispatch({
                type: SocketClientActionTypes.UPDATE_USER,
                data: {
                    details: combinedUserDetails,
                    settings: userSettingsData,
                },
            });
            (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(combinedUserDetails));
            (this.NativeStorage || sessionStorage).setItem('therrUserSettings', JSON.stringify(userSettingsData));
            if (userSettingsData.rememberMe && !this.NativeStorage) {
                localStorage.setItem('therrUser', JSON.stringify(combinedUserDetails));
                localStorage.setItem('therrUserSettings', JSON.stringify(userSettingsData));
            }
        });
    };

    // TODO: RMOBILE-26: Determine if any logout action is necessary for SSO
    logout = (userDetails?: any) => async (dispatch: any) => {
        // NOTE: Native Storage methods return a promise, but in this case we don't need to await
        userDetails = userDetails // eslint-disable-line no-param-reassign
            || JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || null)
            || JSON.parse(await (this.NativeStorage || localStorage).getItem('therrUser') || null);
        if (!this.NativeStorage) {
            localStorage.removeItem('therrSession');
            localStorage.removeItem('therrUser');
            sessionStorage.removeItem('therrSession');
            sessionStorage.removeItem('therrUser');
        } else {
            await this.NativeStorage.multiRemove(['therrSession', 'therrUser', 'therrUserSettings']);
            await (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify({
                id: userDetails?.id,
            }));
        }

        try {
            await ((userDetails ? UsersService.logout(userDetails) : Promise.resolve()) as Promise<any>);
        } catch (err) {
            console.log(err);
        }

        dispatch({
            type: SocketClientActionTypes.LOGOUT,
            data: {
                id: userDetails?.id,
                idToken: userDetails?.idToken,
                userName: userDetails?.userName,
            },
        });
        this.socketIO.removeAllListeners('connect');
        this.socketIO.disconnect();
        this.GoogleSignin?.signOut();
        // NOTE: Socket will disconnect in reducer after event response from server (SESSION_CLOSED)
    };

    register = (data: any) => (dispatch: any) => UsersService.create(data).then((response) => {
        const {
            accessLevels, email, id, userName,
        } = response && response.data;
        // TODO: Determine if it is necessary to dispatch anything after user registers
        // set current user?
        dispatch({
            type: SocketClientActionTypes.REGISTER,
            data: {
                accessLevels,
                email,
                id,
                userName,
            },
        });
        return { email, id, userName };
    });

    update = (id: string, data: any) => (dispatch: any) => UsersService.update(id, data).then(async (response) => {
        const {
            accessLevels,
            blockedUsers,
            email,
            firstName,
            hasAgreedToTerms,
            isBusinessAccount,
            isCreatorAccount,
            isSuperUser,
            phoneNumber,
            lastName,
            userName,
            media,
            settingsThemeName,
            settingsBio,
            settingsTherrCoinTotal,
            settingsAreaCoinTotal,
            settingsBirthdate,
            settingsGender,
            settingsLocale,
            settingsWebsite,
            settingsIsProfilePublic,
            settingsPushTopics,
            settingsEmailMarketing,
            settingsEmailBusMarketing,
            settingsEmailBackground,
            settingsEmailInvites,
            settingsEmailLikes,
            settingsEmailMentions,
            settingsEmailMessages,
            settingsEmailReminders,
            settingsIsAccountSoftDeleted,
            settingsPushMarketing,
            settingsPushBackground,
            settingsPushInvites,
            settingsPushLikes,
            settingsPushMentions,
            settingsPushMessages,
            settingsPushReminders,
            shouldHideMatureContent,
            organizations,
        } = response?.data || {};
        // TODO: Determine if it is necessary to dispatch anything after user registers
        // set current user?
        const sessionUserDetails = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || {});
        const localUserDetails = JSON.parse(await (this.NativeStorage || localStorage).getItem('therrUser') || {});
        const sessionUserSettings = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUserSettings') || {});
        const localUserSettings = JSON.parse(await (this.NativeStorage || localStorage).getItem('therrUserSettings') || {});
        const userData: IUser = Immutable.from({
            ...localUserDetails,
            ...sessionUserDetails,
            ...response.data,
        });
        // TODO: Get user settings from db
        const userSettingsData: IUser = Immutable.from({
            ...localUserSettings,
            ...sessionUserSettings,
            locale: 'en-us',
            mobileThemeName: settingsThemeName || 'retro',
            settingsBio,
            settingsTherrCoinTotal,
            settingsAreaCoinTotal,
            settingsBirthdate,
            settingsGender,
            settingsLocale,
            settingsWebsite,
            settingsIsProfilePublic,
            settingsIsAccountSoftDeleted,
            settingsPushTopics,
            settingsEmailMarketing,
            settingsEmailBusMarketing,
            settingsEmailBackground,
            settingsEmailInvites,
            settingsEmailLikes,
            settingsEmailMentions,
            settingsEmailMessages,
            settingsEmailReminders,
            settingsPushMarketing,
            settingsPushBackground,
            settingsPushInvites,
            settingsPushLikes,
            settingsPushMentions,
            settingsPushMessages,
            settingsPushReminders,
        });
        (this.NativeStorage || localStorage).setItem('therrUser', JSON.stringify(userData));
        (this.NativeStorage || localStorage).setItem('therrUserSettings', JSON.stringify(userSettingsData));
        (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(userData));
        (this.NativeStorage || sessionStorage).setItem('therrUserSettings', JSON.stringify(userSettingsData));

        dispatch({
            type: SocketClientActionTypes.UPDATE_USER,
            data: {
                details: {
                    accessLevels,
                    blockedUsers,
                    email,
                    id,
                    hasAgreedToTerms,
                    isBusinessAccount,
                    isCreatorAccount,
                    isSuperUser,
                    shouldHideMatureContent,
                    firstName,
                    lastName,
                    phoneNumber,
                    userName,
                    media,
                },
                settings: {
                    mobileThemeName: settingsThemeName || 'retro',
                    settingsBio,
                    settingsTherrCoinTotal,
                    settingsAreaCoinTotal,
                    settingsBirthdate,
                    settingsGender,
                    settingsIsAccountSoftDeleted,
                    settingsLocale,
                    settingsWebsite,
                    settingsIsProfilePublic,
                    settingsPushTopics,
                    settingsEmailMarketing,
                    settingsEmailBusMarketing,
                    settingsEmailBackground,
                    settingsEmailInvites,
                    settingsEmailLikes,
                    settingsEmailMentions,
                    settingsEmailMessages,
                    settingsEmailReminders,
                    settingsPushMarketing,
                    settingsPushBackground,
                    settingsPushInvites,
                    settingsPushLikes,
                    settingsPushMentions,
                    settingsPushMessages,
                    settingsPushReminders,
                },
            },
        });
        return {
            email,
            id,
            userName,
            organizations,
        };
    });

    updateTour = (id: string, data: IUpdateTourArgs) => (dispatch: any) => (this.NativeStorage || sessionStorage)
        .getItem('therrUserSettings').then(async (settings) => {
            const userSettings = JSON.parse(settings || {});
            // TODO: Get user settings from db
            const userSettingsData: IUser = Immutable.from({
                ...userSettings,
                isTouring: data.isTouring,
            });
            (this.NativeStorage || sessionStorage).setItem('therrUserSettings', JSON.stringify(userSettingsData));

            dispatch({
                type: UserActionTypes.UPDATE_USER_TOUR,
                data,
            });
        });

    updateFirstTimeUI = (hasCompletedFTUI = true) => (dispatch: any) => {
        dispatch({
            type: UserActionTypes.UPDATE_USER_FTUI,
            data: {
                hasCompletedFTUI,
            },
        });
    };

    claimMyAchievement = (id: string, coins: number | string) => (dispatch: any) => UsersService
        .claimMyAchievement(id).then(async (response) => {
            const userDetails = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || {});
            const userSettings = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUserSettings') || {});
            const userData: IUser = Immutable.from({
                ...userDetails,
                settingsTherrCoinTotal: parseFloat(coins as string || '0') + parseFloat(userDetails.settingsTherrCoinTotal || '0'),
            });
            const userSettingsData: IUser = Immutable.from({
                ...userSettings,
                settingsTherrCoinTotal: parseFloat(coins as string) + parseFloat(userDetails.settingsTherrCoinTotal),
            });
            (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(userData));
            (this.NativeStorage || sessionStorage).setItem('therrUserSettings', JSON.stringify(userSettingsData));

            dispatch({
                type: UserActionTypes.UPDATE_MY_ACHIEVEMENTS,
                data: response?.data,
            });
            dispatch({
                type: UserActionTypes.UPDATE_USER_POINTS,
                data: {
                    settingsTherrCoinTotal: coins,
                },
            });

            return response?.data;
        });

    getMyAchievements = () => (dispatch: any) => UsersService.getMyAchievements().then((response) => {
        const mapped = {};
        response.data?.forEach((ach) => { mapped[ach.id] = ach; });
        dispatch({
            type: UserActionTypes.GET_MY_ACHIEVEMENTS,
            data: mapped,
        });

        return response?.data;
    });

    // User Groups
    createUserGroup = (data: any) => (dispatch: any) => UsersService.createUserGroup(data).then((response: any) => {
        dispatch({
            type: UserActionTypes.USER_GROUP_CREATED,
            data: response.data,
        });

        return response.data;
    });

    getUserGroups = (query: {
        withGroups?: boolean;
    } = {}) => (dispatch: any) => UsersService.getUserGroups(query)
        .then((response: any) => {
            dispatch({
                type: UserActionTypes.GET_USER_GROUPS,
                data: response.data,
            });

            return response.data;
        });

    updateUserGroup = (groupId: string, data: any) => (dispatch: any) => UsersService.updateUserGroup(groupId, data)
        .then((response: any) => {
            dispatch({
                type: UserActionTypes.USER_GROUP_UPDATED,
                data: response.data,
            });

            return response.data;
        });

    deleteUserGroup = (groupId: string) => (dispatch: any) => UsersService.deleteUserGroup(groupId)
        .then((response: any) => {
            dispatch({
                type: UserActionTypes.USER_GROUP_DELETED,
                data: {
                    id: groupId,
                },
            });

            return response.data;
        });

    // User Interests
    getUserInterests = () => (dispatch: any) => UsersService.getUserInterests().then((response: any) => {
        dispatch({
            type: UserActionTypes.GET_USER_INTERESTS,
            data: response.data,
        });

        return response.data;
    });

    updateUserInterests = (data: any) => (dispatch: any) => UsersService.updateUserInterests(data).then((response: any) => {
        dispatch({
            type: UserActionTypes.USER_INTERESTS_UPDATED,
            data: response.data,
        });

        return response.data;
    });

    // Thoughts
    createThought = (data: any) => (dispatch: any) => UsersService.createThought(data).then((response: any) => {
        dispatch({
            type: UserActionTypes.THOUGHT_CREATED,
            data: response.data,
        });
        if (!response.data?.parentId) {
            dispatch({
                type: ContentActionTypes.INSERT_ACTIVE_THOUGHTS,
                data: [response.data],
            });
        }

        return response.data;
    });

    getThoughtDetails = (id: number, data: any) => (dispatch: any) => UsersService.getThoughtDetails(id, data)
        .then((response: any) => {
            dispatch({
                type: UserActionTypes.GET_THOUGHT_DETAILS,
                data: response.data,
            });

            return response.data;
        });

    searchThoughts = (query: any, data: ISearchThoughtsArgs = {}) => (dispatch: any) => UsersService
        .searchThoughts(query, data).then((response: any) => {
            if (query.query === 'connections') {
                dispatch({
                    type: UserActionTypes.GET_THOUGHTS,
                    data: response.data,
                });
            }

            if (query.query === 'me') {
                dispatch({
                    type: UserActionTypes.GET_MY_THOUGHTS,
                    data: response.data,
                });
            }

            // Return so we can react by searching for associated reactions
            return Promise.resolve(response.data);
        });

    deleteThought = (args: { ids: string[] }) => (dispatch: any) => UsersService.deleteThoughts(args).then(() => {
        dispatch({
            type: UserActionTypes.THOUGHT_DELETED,
            data: {
                ids: args.ids,
            },
        });
        args.ids.forEach((id) => {
            dispatch({
                type: ContentActionTypes.REMOVE_ACTIVE_THOUGHTS,
                data: {
                    thoughtId: id,
                },
            });
        });
    });
}

export default UsersActions;
