import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys that contain sensitive data and should use secure storage when available
const SECURE_KEYS = ['therrRefreshToken'];

let Keychain: any = null;

try {
    Keychain = require('react-native-keychain');
} catch (e) {
    // react-native-keychain not installed, fall back to AsyncStorage
}

const KEYCHAIN_SERVICE = 'therr-secure-storage';

/**
 * Wrapper around AsyncStorage that uses react-native-keychain for sensitive data
 * when available. Falls back to AsyncStorage if Keychain is not installed.
 *
 * To enable secure storage:
 * 1. Install react-native-keychain: npm install react-native-keychain --legacy-peer-deps
 * 2. Run pod install for iOS
 * 3. Rebuild the app
 */
const SecureStorage = {
    setItem: async (key: string, value: string): Promise<void> => {
        if (Keychain && SECURE_KEYS.includes(key)) {
            try {
                await Keychain.setInternetCredentials(
                    key,
                    key,
                    value,
                    { service: KEYCHAIN_SERVICE },
                );
                return;
            } catch (e) {
                // Fall through to AsyncStorage
            }
        }
        await AsyncStorage.setItem(key, value);
    },

    getItem: async (key: string): Promise<string | null> => {
        if (Keychain && SECURE_KEYS.includes(key)) {
            try {
                const credentials = await Keychain.getInternetCredentials(key);
                if (credentials) {
                    return credentials.password;
                }
                return null;
            } catch (e) {
                // Fall through to AsyncStorage
            }
        }
        return AsyncStorage.getItem(key);
    },

    removeItem: async (key: string): Promise<void> => {
        if (Keychain && SECURE_KEYS.includes(key)) {
            try {
                await Keychain.resetInternetCredentials(key);
            } catch (e) {
                // Continue to also clean AsyncStorage
            }
        }
        await AsyncStorage.removeItem(key);
    },

    multiRemove: async (keys: string[]): Promise<void> => {
        const secureKeys = keys.filter((k) => SECURE_KEYS.includes(k));
        const regularKeys = keys.filter((k) => !SECURE_KEYS.includes(k));

        if (Keychain && secureKeys.length > 0) {
            await Promise.all(
                secureKeys.map((key) => Keychain.resetInternetCredentials(key).catch(() => {})),
            );
        }

        if (regularKeys.length > 0) {
            await AsyncStorage.multiRemove(regularKeys);
        }
        // Also remove secure keys from AsyncStorage in case of migration
        if (secureKeys.length > 0) {
            await AsyncStorage.multiRemove(secureKeys);
        }
    },
};

export default SecureStorage;
