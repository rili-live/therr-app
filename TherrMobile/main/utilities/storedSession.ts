import SecureStorage from './SecureStorage';

/**
 * The signed-in session as the app persisted it, for code that runs without the React tree.
 *
 * Notifee's background event handler and the home-screen widget's refresh task both run in the
 * headless JS context — the app process may never have rendered anything — so there is no Redux
 * store to read the user from and no axios interceptor to attach the token. Both read the session
 * from the same place `getStore` reads it at cold start (SecureStorage → Keychain,
 * `AFTER_FIRST_UNLOCK`, so it is readable from a background wake).
 *
 * An expired token is indistinguishable from a missing one here: there is no refresh flow in the
 * headless context, and quietly attempting one would risk rotating the refresh token outside the
 * interceptor that tracks it. Callers treat a 401 the same as no session — leave it to the app.
 */
export interface IStoredSession {
    id?: string;
    idToken?: string;
    locale: string;
}

const parseJson = (raw: string | null): any => {
    try {
        return JSON.parse(raw || '{}') || {};
    } catch {
        return {};
    }
};

const readStoredSession = async (): Promise<IStoredSession> => {
    const [userJson, settingsJson] = await Promise.all([
        SecureStorage.getItem('therrUser').catch(() => null),
        SecureStorage.getItem('therrUserSettings').catch(() => null),
    ]);

    const user = parseJson(userJson);
    const settings = parseJson(settingsJson);

    return { id: user?.id, idToken: user?.idToken, locale: settings?.locale || 'en-us' };
};

export default readStoredSession;
