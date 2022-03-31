import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { AccessLevels } from 'therr-js-utilities/constants';
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

const googleOAuth2ClientId = `${globalConfig[process.env.NODE_ENV].googleOAuth2WebClientId}`;
const googleOAuth2Client = new OAuth2Client(googleOAuth2ClientId);

interface IRequiredUserDetails {
    email: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    userName?: string;
}

interface IUserByInviteDetails {
    fromName: string;
    fromEmail: string;
    toEmail: string;
}

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

const createUserHelper = (userDetails: IRequiredUserDetails, isSSO = false, userByInviteDetails?: IUserByInviteDetails) => {
    // TODO: Supply user agent to determine if web or mobile
    const codeDetails = generateCode({ email: userDetails.email, type: 'email' });
    const verificationCode = { type: codeDetails.type, code: codeDetails.code };
    // Create a different/random permanent password as a placeholder
    const password = (isSSO || !!userByInviteDetails) ? generateOneTimePassword(8) : (userDetails.password || '');
    let user;

    return Store.verificationCodes.createCode(verificationCode)
        .then(() => hashPassword(password))
        .then((hash) => {
            const isMissingUserProps = isUserProfileIncomplete(userDetails);
            const userAccessLevels = [
                AccessLevels.DEFAULT,
            ];
            if (isSSO) {
                if (isMissingUserProps) {
                    userAccessLevels.push(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                } else {
                    userAccessLevels.push(AccessLevels.EMAIL_VERIFIED);
                }
            }
            return Store.users.createUser({
                accessLevels: JSON.stringify(userAccessLevels),
                email: userDetails.email,
                firstName: userDetails.firstName || undefined,
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
                        });

                        if (isSSO) {
                            return sendSSONewUserEmail({
                                subject: '[Account Created] Therr One-Time Password',
                                toAddresses: [userDetails.email],
                            }, {
                                name: userDetails.email,
                                oneTimePassword: otPassword,
                            });
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
                        });
                    })
                    .then(() => user);
            }

            // Fire and forget
            sendNewUserAdminNotificationEmail({
                subject: '[New User] New User Registration',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            }, {
                name: userDetails.firstName && userDetails.lastName ? `${userDetails.firstName} ${userDetails.lastName}` : userDetails.email,
            });

            // STANDARD USER REGISTRATION
            return sendVerificationEmail({
                subject: '[Account Verification] Therr User Account',
                toAddresses: [userDetails.email],
            }, {
                name: userDetails.firstName && userDetails.lastName ? `${userDetails.firstName} ${userDetails.lastName}` : userDetails.email,
                verificationCodeToken: codeDetails.token,
            }).then(() => user);
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
        nonce?: string;
        idToken: string;
        password: string;
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
            verifyTokenPromise = googleOAuth2Client.verifyIdToken({
                idToken: reqBody.idToken,
                audience: googleOAuth2ClientId, // Specify the CLIENT_ID of the app that accesses the backend
                // Or, if multiple clients access the backend:
                // [CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
            });
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

            if (!userSearchResults.length) { // First time SSO login
                return createUserHelper({
                    email: reqBody.userEmail,
                    firstName: reqBody.userFirstName,
                    lastName: reqBody.userLastName,
                }, true).then((user) => [true, user]);
            }

            // Verify user because they are using email SSO
            const isMissingUserProps = isUserProfileIncomplete(userSearchResults[0], false);
            const userAccessLevels = [
                AccessLevels.DEFAULT,
            ];
            if (isMissingUserProps) {
                userAccessLevels.push(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
            } else {
                userAccessLevels.push(AccessLevels.EMAIL_VERIFIED);
            }

            return [true, { ...userSearchResults[0], accessLevels: userAccessLevels }];
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
    isUserProfileIncomplete,
    createUserHelper,
    validateCredentials,
};
