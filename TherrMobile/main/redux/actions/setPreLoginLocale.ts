import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import SecureStorage from '../../utilities/SecureStorage';

/**
 * Updates the app locale before the user is authenticated (Login/Register screens).
 *
 * There is no session yet, so we persist the choice locally (Redux + SecureStorage's
 * `therrUserSettings`) rather than hitting the backend. The selection is later saved to
 * the new account during registration (sent as `settingsLocale`) and confirmed by the
 * server response on login. Keeping it in the same `therrUserSettings` shape the rest of
 * the app already reads means the chosen language survives an app restart pre-login.
 */
const setPreLoginLocale = (locale: string) => async (dispatch: any, getState: any) => {
    const currentSettings = getState()?.user?.settings || {};
    const newSettings = {
        ...currentSettings,
        locale,
        settingsLocale: locale,
    };

    try {
        const storedSettings = JSON.parse((await SecureStorage.getItem('therrUserSettings')) || '{}');
        await SecureStorage.setItem('therrUserSettings', JSON.stringify({
            ...storedSettings,
            locale,
            settingsLocale: locale,
        }));
    } catch (err) {
        // Non-fatal: still update Redux so the UI reflects the selection for this session
    }

    // RESET_USER_SETTINGS replaces the settings slice wholesale (vs. UPDATE_USER which also
    // mutates `details`). We merge over the current settings above so unrelated defaults
    // (e.g. mobileThemeName) are preserved.
    dispatch({
        type: SocketClientActionTypes.RESET_USER_SETTINGS,
        data: {
            settings: newSettings,
        },
    });
};

export default setPreLoginLocale;
