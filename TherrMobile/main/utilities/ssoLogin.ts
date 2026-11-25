/**
 * Shared handling for "Continue with Google / Apple".
 *
 * The sign-in form, the e-mail sign-up form and the sign-up screen all offer SSO, and each
 * used to carry its own copy of the two functions below. Keeping them here means a fix to
 * the payload or the error copy reaches every entry point at once.
 */

export interface ISSOUserDetails {
    isSSO: boolean;
    idToken: string;
    nonce?: string;
    ssoProvider: string;
    ssoPlatform?: string;
    userFirstName?: string;
    userLastName?: string;
    userPhoneNumber?: string;
    userEmail: string;
}

/**
 * Builds the login payload from what the SSO button hands back, or returns null when the
 * provider has not verified the e-mail address — the server refuses those anyway.
 */
export const buildSSOUserDetails = (
    idToken: string,
    user: any,
    additionalUserInfo: any,
    provider: string,
    platform: string,
): ISSOUserDetails | null => {
    if (!user?.emailVerified) {
        return null;
    }

    // `displayName.split[0]` (indexing the method, not calling it) is what this used to read,
    // which always yielded undefined; the fallback only matters when the provider sends no
    // given/family name, which Apple does on every sign-in after the first.
    const nameParts = typeof user.displayName === 'string' ? user.displayName.trim().split(/\s+/) : [];

    return {
        isSSO: true,
        idToken,
        nonce: additionalUserInfo?.profile?.nonce,
        ssoProvider: provider,
        ssoPlatform: platform,
        userPhoneNumber: user.phoneNumber,
        userFirstName: additionalUserInfo?.given_name || nameParts[0] || undefined,
        userLastName: additionalUserInfo?.family_name || nameParts.slice(1).join(' ') || undefined,
        userEmail: user.email,
    };
};

/**
 * Maps an SSO button failure to user-facing copy, or null when the user simply backed out of
 * the provider's sheet — their own choice, not an error to report back.
 */
export const getSSOErrorCopy = (
    err: any,
    translate: (key: string, params?: any) => string,
): { title: string; message: string } | null => {
    const errMessage: string = err?.message || '';

    if (errMessage.includes('The user canceled the sign in request')) {
        return null;
    }

    if (errMessage.includes('com.apple.AuthenticationServices.AuthorizationError')) {
        return {
            title: translate('alertTitles.errorWithAppleSSO'),
            message: translate('alertMessages.errorWithAppleSSO'),
        };
    }

    if (errMessage.includes('RNGoogleSignInError')) {
        return {
            title: translate('alertTitles.errorWithGoogleSSO'),
            message: translate('alertMessages.errorWithGoogleSSO'),
        };
    }

    return {
        title: translate('alertTitles.backendErrorMessage'),
        message: translate('alertMessages.backendErrorMessage'),
    };
};
