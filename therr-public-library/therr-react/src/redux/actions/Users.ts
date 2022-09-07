import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IUser, IUserSettings, UserActionTypes } from '../../types/redux/user';
import UsersService, { ISocialSyncs } from '../../services/UsersService';

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

    updateUserInView = (data: any) => (dispatch: any) => {
        dispatch({
            type: UserActionTypes.UPDATE_USER_IN_VIEW,
            data,
        });
    };

    login = (data: any, idTokens?: ILoginSSOTokens) => async (dispatch: any) => {
        await UsersService.authenticate(data).then(async (response) => {
            const {
                accessLevels,
                id,
                idToken,
                email,
                firstName,
                lastName,
                phoneNumber,
                userName,
                media,
                settingsBio,
                settingsThemeName,
                settingsTherrCoinTotal,
                settingsAreaCoinTotal,
                settingsBirthdate,
                settingsGender,
                settingsLocale,
                settingsWebsite,
                settingsPushTopics,
                settingsEmailMarketing,
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
                loginCount,
            } = response.data;
            const userData: IUser = Immutable.from({
                accessLevels,
                id,
                idToken,
                email,
                firstName,
                lastName,
                loginCount,
                phoneNumber,
                userName,
                media,
            });
            // TODO: Get user settings data from db response
            const userSettingsData: IUserSettings = Immutable.from({
                locale: 'en-us',
                mobileThemeName: settingsThemeName || 'retro',
                settingsBio,
                settingsTherrCoinTotal,
                settingsAreaCoinTotal,
                settingsBirthdate,
                settingsGender,
                settingsLocale,
                settingsWebsite,
                settingsPushTopics,
                settingsEmailMarketing,
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
            this.socketIO.io.opts.query = {
                token: idToken,
            };
            // Connect and get socketIO.id
            this.socketIO.on('connect', async () => {
                const sessionData = { id: this.socketIO.id, idTokens: idTokens || {} };
                // NOTE: Native Storage methods return a promise, but in this case we don't need to await
                await (this.NativeStorage || sessionStorage)
                    .setItem('therrSession', JSON.stringify(sessionData));
                if (data.rememberMe && !this.NativeStorage) {
                    localStorage.setItem('therrSession', JSON.stringify(sessionData));
                }

                // These two dispatches were moved here to fix a bug when one dispatch happened before the callback
                // For some reason it caused the websocket server to NOT receive the message in the callback
                dispatch({
                    type: SocketClientActionTypes.LOGIN,
                    data: userData,
                });
                dispatch({
                    type: UserActionTypes.LOGIN,
                    data: userData,
                });
                dispatch({
                    type: SocketClientActionTypes.UPDATE_USER,
                    data: {
                        settings: userSettingsData,
                    },
                });
            });
            this.socketIO.connect();
            (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(userData));
            (this.NativeStorage || sessionStorage).setItem('therrUserSettings', JSON.stringify(userSettingsData));
            if (data.rememberMe && !this.NativeStorage) {
                localStorage.setItem('therrUser', JSON.stringify(userData));
                localStorage.setItem('therrUserSettings', JSON.stringify(userSettingsData));
            }
        });
    };

    // TODO: RMOBILE-26: Determine if any logout action is necessary for SSO
    logout = (userDetails?: any) => async (dispatch: any) => {
        // NOTE: Native Storage methods return a promise, but in this case we don't need to await
        userDetails = userDetails // eslint-disable-line no-param-reassign
            || JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || null);
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
    }

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
            settingsThemeName,
            settingsBio,
            settingsTherrCoinTotal,
            settingsAreaCoinTotal,
            settingsBirthdate,
            settingsGender,
            settingsLocale,
            settingsWebsite,
            settingsPushTopics,
            settingsEmailMarketing,
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
            lastName,
            userName,
            media,
        } = response?.data || {};
        // TODO: Determine if it is necessary to dispatch anything after user registers
        // set current user?
        const userDetails = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || {});
        const userSettings = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUserSettings') || {});
        const userData: IUser = Immutable.from({
            ...userDetails,
            ...response.data,
        });
        // TODO: Get user settings from db
        const userSettingsData: IUser = Immutable.from({
            ...userSettings,
            locale: 'en-us',
            mobileThemeName: settingsThemeName || 'retro',
            settingsBio,
            settingsTherrCoinTotal,
            settingsAreaCoinTotal,
            settingsBirthdate,
            settingsGender,
            settingsLocale,
            settingsWebsite,
            settingsIsAccountSoftDeleted,
            settingsPushTopics,
            settingsEmailMarketing,
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
                    shouldHideMatureContent,
                    firstName,
                    lastName,
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
                    settingsPushTopics,
                    settingsEmailMarketing,
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
        return { email, id, userName };
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

    claimMyAchievement = (id: string, points: number | string) => (dispatch: any) => UsersService
        .claimMyAchievement(id).then(async (response) => {
            const userDetails = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || {});
            const userSettings = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUserSettings') || {});
            const userData: IUser = Immutable.from({
                ...userDetails,
                settingsTherrCoinTotal: parseFloat(points as string) + parseFloat(userDetails.settingsTherrCoinTotal),
            });
            const userSettingsData: IUser = Immutable.from({
                ...userSettings,
                settingsTherrCoinTotal: parseFloat(points as string) + parseFloat(userDetails.settingsTherrCoinTotal),
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
                    settingsTherrCoinTotal: points,
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
}

export default UsersActions;
