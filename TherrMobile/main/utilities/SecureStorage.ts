import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys that contain sensitive data and should use secure storage when available
const SECURE_KEYS = ['therrRefreshToken', 'therrUser'];

let Keychain: any = null;

try {
    Keychain = require('react-native-keychain');
} catch (e) {
    // react-native-keychain not installed, fall back to AsyncStorage
}

const KEYCHAIN_SERVICE = 'therr-secure-storage';
const MIGRATION_FLAG = 'therr_secure_migration_v1';

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
                // Keychain returned nothing — fall through to check AsyncStorage
                // (handles pre-migration data)
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

    // Migrates existing tokens from AsyncStorage to Keychain (runs once per install)
    migrateToSecureStorage: async (): Promise<void> => {
        if (!Keychain) return;

        try {
            const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_FLAG);
            if (alreadyMigrated) return;

            for (const key of SECURE_KEYS) {
                try {
                    const value = await AsyncStorage.getItem(key);
                    if (value) {
                        await Keychain.setInternetCredentials(
                            key,
                            key,
                            value,
                            { service: KEYCHAIN_SERVICE },
                        );
                    }
                } catch (e) {
                    // Migration failed for this key; getItem fallback will still find it in AsyncStorage
                }
            }

            await AsyncStorage.setItem(MIGRATION_FLAG, '1');
        } catch (e) {
            // Migration check failed; will retry on next launch
        }
    },
};

export default SecureStorage;
