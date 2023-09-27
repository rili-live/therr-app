import logSpan from 'therr-js-utilities/log-or-update-span';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { AccessLevels, UserConnectionTypes } from 'therr-js-utilities/constants';
import Store from '../../store';
import { hashPassword } from '../../utilities/userHelpers';
import { validatePassword } from '../../utilities/passwordUtils';
import generateCode from '../../utilities/generateCode';
import { sendVerificationEmail } from '../../api/email';
import generateOneTimePassword from '../../utilities/generateOneTimePassword';
import sendSSONewUserEmail from '../../api/email/sendSSONewUserEmail';
import sendNewUserInviteEmail from '../../api/email/sendNewUserInviteEmail';
import sendNewUserAdminNotificationEmail from '../../api/email/admin/sendNewUserAdminNotificationEmail';
import * as globalConfig from '../../../../../global-config';
import handleHttpError from '../../utilities/handleHttpError';
import { getMappedSocialSyncResults } from '../socialSync';

const googleOAuth2ClientId = `${globalConfig[process.env.NODE_ENV].googleOAuth2WebClientId}`;
const googleOAuth2Client = new OAuth2Client(googleOAuth2ClientId);
const googleOAuth2ClientIdAndroid = `${globalConfig[process.env.NODE_ENV].googleOAuth2WebClientIdAndroid}`;
const googleOAuth2ClientAndroid = new OAuth2Client(googleOAuth2ClientIdAndroid);
const googleOAuth2ClientIdiOS = `${globalConfig[process.env.NODE_ENV].googleOAuth2WebClientIdiOS}`;
const googleOAuth2ClientiOS = new OAuth2Client(googleOAuth2ClientIdiOS);

interface IRequiredUserDetails {
    email: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    userName?: string;
    isBusinessAccount?: boolean;
    isDashboardRegistration?: boolean;
}

export interface IUserByInviteDetails {
    fromName: string;
    fromEmail: string;
    toEmail: string;
}

interface IGetUserHelperArgs {
    isAuthorized: boolean;
    requestingUserId?: string;
    res: any;
    targetUserParams: {
        id?: string;
        userName?: string;
    };
}

/**
 * True if the user profile setting is public or the requesting user is friends with the target user profile
 * @returns boolean
 */
const isUserInfoPublic = (user, connection) => connection?.isMe || user.settingsIsProfilePublic
    || (connection?.requestStatus === UserConnectionTypes.COMPLETE && !connection?.isConnectionBroken);

const getUserProfileResponse = (userResult, friendship: undefined | { [key: string]: any }, connectionCount: number, socialSyncs) => {
    // Only select specific properties should be returned
    const sanitizedUserResult: any = {
        id: userResult.id,
        userName: userResult.userName,
        firstName: userResult.firstName,
        lastName: userResult.lastName,
        isBusinessAccount: userResult.isBusinessAccount,
        isBlocked: userResult.isBlocked,
        media: userResult.media, // TODO: Hide alt text if it includes first/lastname
        createdAt: userResult.createdAt,
        updatedAt: userResult.updatedAt,
        settingsBio: userResult.settingsBio,
        settingsWebsite: userResult.settingsWebsite,
        settingsIsAccountSoftDeleted: userResult.settingsIsAccountSoftDeleted,
    };

    // Public User Profile
    if (isUserInfoPublic(userResult, friendship)) {
        return {
            ...sanitizedUserResult,

            // More details
            isNotConnected: !friendship || friendship.requestStatus === UserConnectionTypes.MIGHT_KNOW,
            isPendingConnection: friendship
                // eslint-disable-next-line max-len
                ? (friendship.requestStatus === UserConnectionTypes.DENIED
                    || friendship.requestStatus === UserConnectionTypes.PENDING
                    || friendship.requestStatus === UserConnectionTypes.BLOCKED)
                : false,
            connectionCount,
            socialSyncs,
        };
    }

    // Private User Profile
    const media = {
        ...(sanitizedUserResult?.media || {}),
    };

    if (media?.profilePicture?.altText) {
        media.profilePicture.altText = '';
    }

    return {
        id: sanitizedUserResult.id,
        userName: sanitizedUserResult.userName,
        firstName: sanitizedUserResult.settingsIsProfilePublic ? sanitizedUserResult.firstName : '',
        lastName: sanitizedUserResult.settingsIsProfilePublic ? sanitizedUserResult.lastName : '',
        settingsBio: sanitizedUserResult.settingsBio,
        settingsIsProfilePublic: sanitizedUserResult.settingsIsProfilePublic,
        media,

        // More details
        isNotConnected: true,
        isPendingConnection: friendship
            // eslint-disable-next-line max-len
            ? (friendship.requestStatus === UserConnectionTypes.DENIED
                || friendship.requestStatus === UserConnectionTypes.PENDING
                || friendship.requestStatus === UserConnectionTypes.BLOCKED)
            : false,
        connectionCount,
        socialSyncs,
    };
};

const getUserFriendship = (isMe, targetUserId, requestingUserId?) => {
    if (!requestingUserId) {
        return Promise.resolve(undefined);
    }

    if (isMe) {
        return Promise.resolve({ isMe: true });
    }

    return Store.userConnections.getUserConnections({
        acceptingUserId: targetUserId,
        requestingUserId,
    }, true).then((response) => response[0]);
};

const getUserHelper = ({
    isAuthorized,
    requestingUserId,
    targetUserParams,
    res,
}: IGetUserHelperArgs): Promise<any> => Store.users.getUsers({ ...targetUserParams, settingsIsAccountSoftDeleted: false })
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: `No user found with the provided params: ${JSON.stringify(targetUserParams)}`,
                statusCode: 404,
            });
        }

        const userResult = results[0];

        if (!isAuthorized && !userResult.settingsIsProfilePublic) {
            return handleHttpError({
                res,
                message: 'NotAuthorized to view non-public users',
                statusCode: 400,
            });
        }

        const isMe = Boolean(isAuthorized && requestingUserId && requestingUserId === userResult.id);

        const userPromises: Promise<any>[] = [];
        const countPromise = Store.userConnections.countUserConnections(userResult.id);
        const syncsPromise = Store.socialSyncs.getSyncs(userResult.id).then((syncResults) => getMappedSocialSyncResults(isMe, syncResults));
        const friendPromise: Promise<undefined | { [key: string]: any }> = getUserFriendship(isMe, userResult.id, requestingUserId);

        userPromises.push(friendPromise, countPromise, syncsPromise);

        return Promise.all(userPromises).then(([friendship, countResults, syncs]) => {
            const user = results[0];
            delete user.password;
            delete user.oneTimePassword;
            delete user.verificationCodes;

            // TODO: Only send particular information (based on user privacy settings)
            const userResponse = getUserProfileResponse(user, friendship, parseInt(countResults[0]?.count || 0, 10), syncs);
            return res.status(200).send(userResponse);
        });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const isUserProfileIncomplete = (updateArgs, existingUser?) => {
    if (!existingUser) {
        const requestIsMissingProperties = !updateArgs?.phoneNumber
            || !updateArgs?.userName
            || !updateArgs?.firstName
            || !updateArgs?.lastName;

        return requestIsMissingProperties;
    }

    // NOTE: The user update query does not nullify missing properties when the respective property already exists in the DB
    const requestDoesNotCompleteProfile = !(updateArgs.phoneNumber || existingUser.phoneNumber)
        || !(updateArgs.userName || existingUser.userName)
        || !(updateArgs.firstName || existingUser.firstName)
        || !(updateArgs.lastName || existingUser.lastName);

    return requestDoesNotCompleteProfile;
};

// eslint-disable-next-line default-param-last
const createUserHelper = (userDetails: IRequiredUserDetails, isSSO = false, userByInviteDetails?: IUserByInviteDetails, locale = 'en-us') => {
    // TODO: Supply user agent to determine if web or mobile
    const codeDetails = generateCode({ email: userDetails.email, type: 'email' });
    const verificationCode = { type: codeDetails.type, code: codeDetails.code };
    // Create a different/random permanent password as a placeholder
    const password = (isSSO || !!userByInviteDetails) ? generateOneTimePassword(8) : (userDetails.password || '');
    const hasAgreedToTerms = !userByInviteDetails;
    let user;

    return Store.verificationCodes.createCode(verificationCode)
        .then(() => hashPassword(password))
        .then((hash) => {
            const isMissingUserProps = isUserProfileIncomplete(userDetails);
            const userAccessLevels = new Set([
                AccessLevels.DEFAULT,
            ]);
            if (userDetails.isDashboardRegistration) {
                userAccessLevels.add(AccessLevels.DASHBOARD_SIGNUP);
            }
            if (isSSO) {
                if (isMissingUserProps) {
                    userAccessLevels.add(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                } else {
                    userAccessLevels.add(AccessLevels.EMAIL_VERIFIED);
                }
            }
            return Store.users.createUser({
                accessLevels: JSON.stringify([...userAccessLevels]),
                email: userDetails.email,
                firstName: userDetails.firstName || undefined,
                hasAgreedToTerms,
                isBusinessAccount: userDetails.isBusinessAccount,
                lastName: userDetails.lastName || undefined,
                password: hash,
                phoneNumber: userDetails.phoneNumber || undefined,
                userName: userDetails.userName || undefined,
                verificationCodes: JSON.stringify({
                    [codeDetails.type]: {
                        code: codeDetails.code,
                    },
                }),
            });
        })
        // TODO: RSERV-53 - Create userResource with default values (from library constant DefaultUserResources)
        .then((results) => {
            user = results[0];
            delete user.password;

            // Fire and forget: Create initial achievement so user is aware of invite rewards
            Store.userAchievements.create([
                {
                    achievementId: 'socialite_1_1',
                    userId: user.id,
                    achievementClass: 'socialite',
                    achievementTier: '1_1',
                    progressCount: 0,
                },
                {
                    achievementId: 'explorer_1_1',
                    userId: user.id,
                    achievementClass: 'explorer',
                    achievementTier: '1_1',
                    progressCount: 0,
                },
                {
                    achievementId: 'influencer_1_1',
                    userId: user.id,
                    achievementClass: 'influencer',
                    achievementTier: '1_1',
                    progressCount: 0,
                },
                {
                    achievementId: 'thinker_1_1',
                    userId: user.id,
                    achievementClass: 'thinker',
                    achievementTier: '1_1',
                    progressCount: 0,
                },
            ]).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Error while creating socialite achievements during registration'],
                    traceArgs: {
                        'error.message': err?.message,
                    },
                });
            });

            if (isSSO || !!userByInviteDetails) {
                // TODO: RMOBILE-26: Centralize password requirements
                const msExpiresAt = Date.now() + (1000 * 60 * 60 * 6); // 6 hours
                const otPassword = generateOneTimePassword(8);

                return hashPassword(otPassword)
                    .then((hash) => Store.users.updateUser({
                        oneTimePassword: `${hash}:${msExpiresAt}`,
                    }, {
                        email: userDetails.email,
                    }))
                    // SSO USER AUTO-REGISTRATION ON FIRST LOGIN
                    .then(() => {
                        // Fire and forget
                        sendNewUserAdminNotificationEmail({
                            subject: userByInviteDetails ? '[New User] New User Registration by Invite' : '[New User] New User Registration',
                            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                        }, {
                            name: userDetails.firstName && userDetails.lastName ? `${userDetails.firstName} ${userDetails.lastName}` : userDetails.email,
                            inviterEmail: userByInviteDetails?.fromEmail || '',
                        }, {
                            isBusinessAccount: userDetails.isBusinessAccount,
                            isDashboardRegistration: userDetails.isDashboardRegistration,
                        });

                        if (isSSO) {
                            return sendSSONewUserEmail({
                                subject: '[Account Created] Therr One-Time Password',
                                toAddresses: [userDetails.email],
                            }, {
                                name: userDetails.email,
                                oneTimePassword: otPassword,
                            }, userDetails.isDashboardRegistration);
                        }

                        return sendNewUserInviteEmail({
                            subject: `${userByInviteDetails?.fromName} Invited You to Therr app`,
                            toAddresses: [userByInviteDetails?.toEmail || ''],
                        }, {
                            fromName: userByInviteDetails?.fromName || '',
                            fromEmail: userByInviteDetails?.fromEmail || '',
                            toEmail: userByInviteDetails?.toEmail || '',
                            verificationCodeToken: codeDetails.token,
                            oneTimePassword: otPassword,
                        }, !!userDetails.isDashboardRegistration);
                    })
                    .then(() => user);
            }

            // Fire and forget
            sendNewUserAdminNotificationEmail({
                subject: '[New User] New User Registration',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            }, {
                name: userDetails.firstName && userDetails.lastName ? `${userDetails.firstName} ${userDetails.lastName}` : userDetails.email,
            }, {
                isBusinessAccount: userDetails.isBusinessAccount,
                isDashboardRegistration: userDetails.isDashboardRegistration,
            });

            // STANDARD USER REGISTRATION
            // TODO: If this bounces, update user email preferences and notify admin
            return sendVerificationEmail({
                subject: '[Account Verification] Therr User Account',
                toAddresses: [userDetails.email],
            }, {
                name: userDetails.firstName && userDetails.lastName ? `${userDetails.firstName} ${userDetails.lastName}` : userDetails.email,
                verificationCodeToken: codeDetails.token,
            }, userDetails.isDashboardRegistration).then(() => user);
        })
        .catch((error) => {
            console.log(error);
            // Delete user to allow re-registration
            if (user && user.id) {
                Store.users.deleteUsers({ id: user.id });
            }
            throw error;
        });
};

interface IValidateCredentials {
    locale: string;
    reqBody: {
        isSSO: boolean;
        ssoProvider?: string;
        ssoPlatform?: string;
        nonce?: string;
        idToken: string;
        password: string;
        userPhoneNumber: string;
        userEmail: string;
        userFirstName: string;
        userLastName: string;
    };
}

// eslint-disable-next-line arrow-body-style
const validateCredentials = (userSearchResults, {
    locale,
    reqBody,
}: IValidateCredentials, res) => {
    if (reqBody.isSSO) {
        let verifyTokenPromise;
        if (reqBody.ssoProvider === 'google') {
            if (!reqBody.ssoPlatform) {
                verifyTokenPromise = googleOAuth2Client.verifyIdToken({
                    idToken: reqBody.idToken,
                    audience: googleOAuth2ClientId, // Specify the CLIENT_ID of the app that accesses the backend
                    // Or, if multiple clients access the backend:
                    // [CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
                });
            } else if (reqBody.ssoPlatform === 'android') {
                verifyTokenPromise = googleOAuth2ClientAndroid.verifyIdToken({
                    idToken: reqBody.idToken,
                    audience: googleOAuth2ClientIdAndroid,
                });
            } else if (reqBody.ssoPlatform === 'ios') {
                verifyTokenPromise = googleOAuth2ClientiOS.verifyIdToken({
                    idToken: reqBody.idToken,
                    audience: googleOAuth2ClientIdiOS,
                });
            }
        } else if (reqBody.ssoProvider === 'apple') {
            verifyTokenPromise = appleSignin.verifyIdToken(reqBody.idToken, {
                // Optional Options for further verification - Full list can be found
                // here https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
                audience: 'com.therr.mobile.Therr', // client id - can also be an array
                nonce: reqBody.nonce,
                ignoreExpiration: false, // default is false
            });
        } else {
            verifyTokenPromise = Promise.reject(new Error('Unsupported SSO Provider'));
        }
        return verifyTokenPromise.then((response) => {
            // Make sure that Google account email is verified
            if ((reqBody.ssoProvider === 'google' && !response.getPayload()?.email_verified)
                || (reqBody.ssoProvider === 'apple' && !response.email_verified)) {
                return [false, userSearchResults[0]];
            }

            // Create user with phonenumber equal to 'apple-sso'
            // We can use this in the future to mark an account un-verified and still allow Apple SSO
            if (!userSearchResults.length) { // First time SSO login
                return createUserHelper({
                    email: reqBody.userEmail,
                    firstName: reqBody.userFirstName,
                    lastName: reqBody.userLastName,
                    phoneNumber: reqBody.userPhoneNumber || (reqBody.ssoProvider === 'apple' ? 'apple-sso' : undefined),
                }, true, undefined, locale).then((user) => [true, user]);
            }

            // Verify user because they are using email SSO
            const isMissingUserProps = isUserProfileIncomplete(userSearchResults[0], false);
            const userAccessLevels = new Set(
                userSearchResults[0].accessLevels,
            );
            if (isMissingUserProps && !userAccessLevels.has(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)) {
                userAccessLevels.add(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
            } else if (!userAccessLevels.has(AccessLevels.EMAIL_VERIFIED)) {
                userAccessLevels.add(AccessLevels.EMAIL_VERIFIED);
            }

            return [true, { ...userSearchResults[0], accessLevels: [...userAccessLevels] }];
        });
    }

    return validatePassword({
        hashedPassword: userSearchResults[0].password,
        inputPassword: reqBody.password,
        locale,
        oneTimePassword: userSearchResults[0].oneTimePassword,
        res,
    }).then((isSuccess) => [isSuccess, userSearchResults[0]]);
};

export {
    getUserHelper,
    isUserProfileIncomplete,
    createUserHelper,
    validateCredentials,
};
