/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import {
    IAccess,
    AccessCheckType,
    ISearchQuery,
    IUserState,
} from '../types';
import type { IUserAcquisition } from '../utilities/attribution';

interface ILoginCredentials {
    userName: string;
    password: string;
}

interface ILogoutCredentials {
    userName: string;
}

interface IRegisterCredentials {
    // Email is the only universally required field. Names and username are collected during
    // profile creation, and password is optional on the phone-first path below — the shape
    // used to over-declare these as required, which no caller actually satisfied.
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    userName?: string;
    password?: string;
    settingsBirthdate?: string;
    settingsLocale?: string;
    inviteCode?: string;
    // Magic invite-link token: trusts the invited contact channel and
    // auto-connects the user to the inviter on signup.
    inviteToken?: string;
    // Account type, when the sign-up flow collects it up-front. Only the phone-first path does
    // today, and only for a number that already holds an account — the cap is one account per
    // type, so the type can no longer be deferred to profile creation. Everyone else omits
    // these and picks their type on the CreateProfile screen as before.
    isBusinessAccount?: boolean;
    isCreatorAccount?: boolean;
    // Short-lived proof of phone ownership from POST /v1/phone/register/verify. When present,
    // the account is created already phone-verified and `password` may be omitted.
    phoneVerificationToken?: string;
    // Where this signup came from — captured on first landing by
    // `utilities/attribution` and written to `main.userAcquisition`. Advisory
    // telemetry only: a malformed or absent value must never fail a
    // registration, and nothing here may grant access.
    userAcquisition?: IUserAcquisition;
}

export interface ISearchUsersArgs {
    ids?: string[];
    query?: string;
    queryColumnName?: string;
    limit?: number;
    offset?: number;
}

interface IUpdateUser {
    firstName: string;
    lastName: string;
    isBusinessAccount: boolean;
    isCreatorAccount?: boolean;
    phoneNumber: string;
    userName: string;
    password?: string;
    newPassword?: string;
    shouldHideMatureContent?: boolean;
    organization?: {
        id?: string;
        name?: string;
        description?: string;
        settingsGeneralBusinessType?: string;
    }
}

interface IChangePasswordArgs {
    oldPassword: string;
    newPassword: string;
    email: string;
    userName: string;
}

interface ICreateThoughtBody {
    parentId?: string;
    category?: string;
    expiresAt?: any;
    fromUserId: number;
    locale: string;
    isPublic?: boolean;
    isRepost?: boolean;
    message: string;
    mediaIds?: string;
    mentionsIds?: string;
    hashTags?: string;
    maxViews?: number;
}

interface IGetThoughtDetailsArgs {
    withUser?: boolean;
    withReplies?: boolean;
    /**
     * Attaches `thought.parent` (author + message snippet) when the thought is a reply, so the
     * details view can show it belongs to a thread and link back up to it.
     */
    withParent?: boolean;
}

interface IDeleteThoughtsBody {
    ids: string[];
}

export interface ISearchThoughtsArgs {}

export interface ICreateCheckoutSessionArgs {
    /** One of the dashboard's plan slugs: basic | advanced | pro. */
    plan: string;
    billingPeriod?: 'monthly' | 'annual';
    /** Same-origin path to return to if the buyer abandons checkout. */
    cancelPath?: string;
    userAcquisition?: IUserAcquisition;
}

export interface ISocialSyncs {
    syncs: {
        twitter?: {
            username: string;
        };
        youtube?: {
            username: string;
        };
    };
}

class UsersService {
    authenticate = (data: ILoginCredentials) => axios({
        method: 'post',
        url: '/users-service/auth',
        data,
    });

    block = (userId: string, alreadyBockedUsers: number[]) => axios({
        method: 'put',
        url: `/users-service/users/${userId}/block`,
        data: {
            blockedUsers: alreadyBockedUsers,
        },
    });

    changePassword = (data: IChangePasswordArgs) => axios({
        method: 'put',
        url: '/users-service/users/change-password',
        data,
    });

    create = (data: IRegisterCredentials) => axios({
        method: 'post',
        url: '/users-service/users',
        data,
    });

    delete = (userId: string, data: IRegisterCredentials) => axios({
        method: 'delete',
        url: `/users-service/users/${userId}`,
        data,
    });

    get = (id: string) => axios({
        method: 'get',
        url: `/users-service/users/${id}`,
    });

    getByUserName = (userName: string) => axios({
        method: 'get',
        url: `/users-service/users/by-username/${userName}`,
    });

    // Resolves a magic invite-link token to pre-fill data (email/phone/inviter).
    // Public/pre-auth — used by the invite-landing page before the user has an account.
    getInviteByToken = (token: string) => axios({
        method: 'get',
        url: `/users-service/users/invites/${token}`,
    });

    getMe = () => axios({
        method: 'get',
        url: '/users-service/users/me',
    });

    search = (args: ISearchUsersArgs) => axios({
        method: 'post',
        url: '/users-service/users/search',
        data: args,
    });

    searchPairings = (args: ISearchUsersArgs) => axios({
        method: 'post',
        url: '/users-service/users/search-pairings',
        data: args,
    });

    report = (userId: string) => axios({
        method: 'put',
        url: `/users-service/users/${userId}/report`,
        data: {},
    });

    update = (userId: string, data: IUpdateUser) => axios({
        method: 'put',
        url: `/users-service/users/${userId}`,
        data,
    });

    isAuthorized = (access: IAccess, user: IUserState) => {
        const userAccessLevels = user?.details?.accessLevels;
        if (access.isPublic || userAccessLevels) {
            if (!userAccessLevels) {
                return true;
            }
            if (access.type === AccessCheckType.NONE) {
                // User does not have any of the access levels from the check
                return !access.levels.some((lvl) => user.details.accessLevels.includes(lvl));
            }
            if (access.type === AccessCheckType.ANY) {
                // User has at least one of the access levels from the check
                return access.levels.some((lvl) => user.details.accessLevels.includes(lvl));
            }
            if (access.type === AccessCheckType.ALL) {
                // User has all of the access levels from the check
                return !access.levels.some((lvl) => !user.details.accessLevels.includes(lvl));
            }
        }

        return false;
    };

    logout = (data: ILogoutCredentials) => axios({
        method: 'post',
        url: '/users-service/auth/logout',
        data,
    });

    refreshToken = (refreshToken: string, rememberMe?: boolean) => axios({
        method: 'post',
        url: '/users-service/auth/token/refresh',
        data: { refreshToken, rememberMe },
    });

    // Multi-app auth: enumeration-safe email pre-check. Backend always 200s with a generic shape;
    // the `hint` drives client UI (enter_password / try_sso / magic_link / sign_up) without
    // confirming whether the email is registered.
    emailPrecheck = (email: string) => axios({
        method: 'post',
        url: '/users-service/auth/email-precheck',
        data: { email },
    });

    // Mint a single-use, brand-bound handoff code from the currently-signed-in app. The returned
    // `code` is exchanged via `redeemHandoff` in the target app for a fresh login response stamped
    // with the target brand. TTL 60s; never log the code itself.
    mintHandoff = (targetBrand: string) => axios({
        method: 'post',
        url: '/users-service/auth/handoff/mint',
        data: { targetBrand },
    });

    // Redeem a handoff code in the target app. The code IS the credential — no auth header required.
    // The `brand` argument must match the current app's brand variation; the backend enforces this.
    redeemHandoff = (code: string, brand: string) => axios({
        method: 'post',
        url: '/users-service/auth/handoff/redeem',
        data: { code, brand },
    });

    cancelHandoff = (code: string) => axios({
        method: 'post',
        url: '/users-service/auth/handoff/cancel',
        data: { code },
    });

    // Subscribers
    getSubscriptionPreferences = (emailToken: string) => axios({
        method: 'get',
        url: '/users-service/subscribers/preferences',
        headers: {
            'x-subscriber-token': emailToken,
        },
    });

    updateSubscriptionPreferences = (preferences: {
        settingsEmailMarketing: boolean;
        settingsEmailBusMarketing: boolean;
        settingsEmailBackground: boolean;
        settingsEmailInvites: boolean;
        settingsEmailLikes: boolean;
        settingsEmailMentions: boolean;
        settingsEmailMessages: boolean;
        settingsEmailReminders: boolean;
    }, emailToken: string) => axios({
        method: 'post',
        url: '/users-service/subscribers/unsubscribe',
        headers: {
            'x-subscriber-token': emailToken,
        },
        data: preferences,
    });

    sendFeedback = (feedback: string) => axios({
        method: 'post',
        url: '/users-service/subscribers/send-feedback',
        data: {
            feedback,
        },
    });

    // Social Sync
    createUpdateSocialSyncs = (socialSyncs: ISocialSyncs) => axios({
        method: 'post',
        url: '/users-service/social-sync',
        data: socialSyncs,
    });

    getSocialSyncs = (userId: string) => axios({
        method: 'get',
        url: `/users-service/social-sync/${userId}`,
    });

    // Achievements
    claimMyAchievement = (id: string) => axios({
        method: 'post',
        url: `/users-service/users/achievements/${id}/claim`,
    });

    getMyAchievements = () => axios({
        method: 'get',
        url: '/users-service/users/achievements',
    });

    getPublicUserAchievements = (userId: string) => axios({
        method: 'get',
        url: `/users-service/users/achievements/${userId}/public`,
    });

    // Leaderboards
    getLeaderboard = (args?: {
        scope?: 'global' | 'connections';
        period?: 'week' | 'allTime';
        limit?: number;
    }) => {
        const queryParams = [
            `scope=${args?.scope || 'global'}`,
            `period=${args?.period || 'week'}`,
            ...(args?.limit ? [`limit=${args.limit}`] : []),
        ].join('&');
        return axios({
            method: 'get',
            url: `/users-service/users/leaderboards?${queryParams}`,
        });
    };

    requestRewardsExchange = (amount: number, provider: string) => axios({
        method: 'post',
        url: '/users-service/rewards',
        data: {
            amount,
            provider,
        },
    });

    getExchangeRate = () => axios({
        method: 'get',
        url: '/users-service/rewards/exchange-rate',
    });

    // UserGroups (aka forums)
    createUserGroup = (data: any) => axios({
        method: 'post',
        url: '/users-service/users-groups',
        data,
    });

    getUserGroups = (query: {
        withGroups?: boolean;
    } = {}) => {
        let queryStr = '';
        if (query.withGroups) {
            queryStr = '?withGroups=true';
        }
        return axios({
            method: 'get',
            url: `/users-service/users-groups${queryStr}`,
        });
    };

    getGroupMembers = (groupId: string) => axios({
        method: 'get',
        url: `/users-service/users-groups/${groupId}`,
    });

    updateUserGroup = (id: string, data: any) => axios({
        method: 'put',
        url: `/users-service/users-groups/${id}`,
        data,
    });

    deleteUserGroup = (groupId: string) => axios({
        method: 'delete',
        url: `/users-service/users-groups/${groupId}`,
    });

    // User Interests
    getInterests = () => axios({
        method: 'get',
        url: '/users-service/interests',
    });

    getUserInterests = () => axios({
        method: 'get',
        url: '/users-service/users/interests/me',
    });

    updateUserInterests = (data: any) => axios({
        method: 'post',
        url: '/users-service/users/interests/me',
        data,
    });

    // Thoughts
    createThought = (data: ICreateThoughtBody) => axios({
        method: 'post',
        url: '/users-service/thoughts',
        data,
    });

    getThoughtDetails = (id: number, args: IGetThoughtDetailsArgs) => axios({
        method: 'post',
        url: `/users-service/thoughts/${id}/details`,
        data: args,
    });

    searchThoughts = (query: ISearchQuery, data: ISearchThoughtsArgs = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/users-service/thoughts/search${queryString}`,
            data,
        });
    };

    deleteThoughts = (data: IDeleteThoughtsBody) => axios({
        method: 'delete',
        url: '/users-service/thoughts',
        data,
    });

    // Payments
    activateSubscription = (sessionId: string) => axios({
        method: 'post',
        url: `/users-service/payments/checkout/sessions/${sessionId}`,
    });

    /**
     * Start a Stripe Checkout Session and get back the URL to send the browser
     * to. Navigate in the *same tab*: the returning `/payment-complete` page is
     * where the GA4 `purchase` event fires, and a new tab is a new GA4 session
     * with no memory of the campaign that produced the sale.
     *
     * `userAcquisition` is copied into the session's Stripe metadata so the
     * campaign survives independently of the browser session.
     */
    createCheckoutSession = (data: ICreateCheckoutSessionArgs) => axios({
        method: 'post',
        url: '/users-service/payments/checkout/sessions',
        data,
    });

    createCustomerPortalSession = (returnUrl?: string) => axios({
        method: 'post',
        url: '/users-service/payments/customer-portal/sessions',
        data: { returnUrl },
    });
}

export default new UsersService();
