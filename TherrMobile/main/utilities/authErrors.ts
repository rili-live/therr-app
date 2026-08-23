import { ErrorCodes } from 'therr-js-utilities/constants';

type Translate = (key: string, params?: any) => string;

export interface IAuthErrorCopy {
    /** Toast heading. */
    title: string;
    /** Body text, shown both in the toast and in the form's inline alert. */
    message: string;
}

/**
 * Copy for a failed sign-in, whatever path it came from — password, SSO, texted code, or the
 * account picker that follows one.
 *
 * Centralized because the mapping used to be duplicated in `LoginForm` and `RegisterForm` and
 * had already drifted: one showed a toast, the other only an inline alert, and neither had a
 * fallback branch. A rejection that matched no branch produced *nothing at all*, so a failed
 * sign-in read as a button that did nothing. Every path through this function returns copy.
 */
export const getLoginErrorCopy = (error: any, translate: Translate): IAuthErrorCopy => {
    const statusCode = Number(error?.statusCode);

    if (error?.errorCode === ErrorCodes.NOT_VERIFIED) {
        // The password was right; the account just never confirmed its e-mail. Calling this
        // "invalid username/password" sends people off to reset a password that works.
        return {
            title: translate('alertTitles.accountNotVerified'),
            message: translate('forms.loginForm.accountNotVerified'),
        };
    }

    if (statusCode === 429) {
        return {
            title: translate('alertTitles.tooManyAttempts'),
            message: translate('alertMessages.tooManyAttempts'),
        };
    }

    if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
        // 404 ("no user found") deliberately shares the credential message. Confirming which
        // e-mails and phone numbers have accounts is account enumeration, so a wrong identifier
        // and a wrong password have to be indistinguishable from out here.
        return {
            title: translate('alertTitles.loginError'),
            message: translate('forms.loginForm.invalidUsernamePassword'),
        };
    }

    // 5xx, a dropped connection, or an error shape we don't recognize.
    return {
        title: translate('alertTitles.backendErrorMessage'),
        message: translate('forms.loginForm.backendErrorMessage'),
    };
};

/**
 * Copy for a failed sign-up. Shared by the e-mail and phone-first forms for the same reason as
 * above — the two had separate mappings and only one of them translated anything.
 */
export const getRegistrationErrorCopy = (error: any, translate: Translate): IAuthErrorCopy => {
    const statusCode = Number(error?.statusCode);
    const title = translate('alertTitles.registrationError');

    if (error?.errorCode === ErrorCodes.USER_EXISTS) {
        return {
            title,
            message: translate('forms.registerForm.errorMessages.accountExists'),
        };
    }

    if (error?.errorCode === ErrorCodes.TOO_MANY_ACCOUNTS) {
        return {
            title,
            message: translate('forms.phoneSignupForm.errorMessages.accountTypeTaken'),
        };
    }

    if (statusCode === 429) {
        return {
            title: translate('alertTitles.tooManyAttempts'),
            message: translate('alertMessages.tooManyAttempts'),
        };
    }

    if (statusCode === 400 && error?.message) {
        // Field-level validation the client didn't catch first. Passed through as-is; the old
        // code appended `' error (' + parameters + ')'`, which pasted raw backend parameter
        // names into user-facing copy.
        return { title, message: error.message };
    }

    return {
        title,
        message: translate('forms.registerForm.backendErrorMessage'),
    };
};
