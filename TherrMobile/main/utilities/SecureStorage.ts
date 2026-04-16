import AsyncStorage from '@react-native-async-storage/async-storage';
import { MMKV } from 'react-native-mmkv';

// Keys that contain sensitive data and should use secure storage when available
const SECURE_KEYS = ['therrRefreshToken', 'therrUser'];

let Keychain: any = null;

try {
    Keychain = require('react-native-keychain');
} catch (e) {
    // react-native-keychain not installed, fall back to MMKV
}

const KEYCHAIN_SERVICE = 'therr-secure-storage';
const MIGRATION_FLAG = 'therr_secure_migration_v1';
const MMKV_MIGRATION_FLAG = 'therr_mmkv_migration_v1';
const MMKV_NON_SECURE_KEYS = ['therrSession', 'therrUserSettings'];

const mmkv = new MMKV({ id: 'therr-storage' });

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
                // Fall through to MMKV
            }
        }
        mmkv.set(key, value);
    },

    getItem: async (key: string): Promise<string | null> => {
        if (Keychain && SECURE_KEYS.includes(key)) {
            try {
                const credentials = await Keychain.getInternetCredentials(key);
                if (credentials) {
                    return credentials.password;
                }
                // Keychain returned nothing — fall through to MMKV / AsyncStorage
                // (handles pre-migration data)
            } catch (e) {
                // Fall through to MMKV / AsyncStorage
            }
        }
        const mmkvValue = mmkv.getString(key);
        if (mmkvValue !== undefined) {
            return mmkvValue;
        }
        // Pre-MMKV-migration fallback: legacy data may still live in AsyncStorage.
        // Kept for one release to tolerate downgrades and stragglers that haven't
        // executed migrateAsyncStorageToMMKV yet. Safe to remove in a follow-up PR.
        return AsyncStorage.getItem(key);
    },

    removeItem: async (key: string): Promise<void> => {
        if (Keychain && SECURE_KEYS.includes(key)) {
            try {
                await Keychain.resetInternetCredentials(key);
            } catch (e) {
                // Continue to also clean MMKV / AsyncStorage
            }
        }
        mmkv.delete(key);
        // Also clean legacy AsyncStorage copy to avoid stale reads in mixed-state installs.
        await AsyncStorage.removeItem(key);
    },

    multiRemove: async (keys: string[]): Promise<void> => {
        const secureKeys = keys.filter((k) => SECURE_KEYS.includes(k));

        if (Keychain && secureKeys.length > 0) {
            await Promise.all(
                secureKeys.map((key) => Keychain.resetInternetCredentials(key).catch(() => {})),
            );
        }

        keys.forEach((k) => mmkv.delete(k));
        // Also clean legacy AsyncStorage copies (covers both secure and non-secure keys).
        await AsyncStorage.multiRemove(keys);
    },

    // One-shot copy of non-secure keys from AsyncStorage to MMKV. Runs once per
    // install (gated by MMKV_MIGRATION_FLAG). Legacy AsyncStorage data is NOT
    // deleted here so users can downgrade safely; a follow-up release will
    // clean it up and drop the AsyncStorage dependency.
    migrateAsyncStorageToMMKV: async (): Promise<void> => {
        try {
            if (mmkv.getString(MMKV_MIGRATION_FLAG)) return;

            for (const key of MMKV_NON_SECURE_KEYS) {
                try {
                    const value = await AsyncStorage.getItem(key);
                    if (value) {
                        mmkv.set(key, value);
                    }
                } catch (e) {
                    // Migration failed for this key; next launch will retry (flag not set yet)
                }
            }

            // Forward the Keychain-migration flag so migrateToSecureStorage doesn't
            // re-run after AsyncStorage is eventually removed.
            try {
                const secureFlag = await AsyncStorage.getItem(MIGRATION_FLAG);
                if (secureFlag) {
                    mmkv.set(MIGRATION_FLAG, secureFlag);
                }
            } catch (e) {
                // Non-fatal; migrateToSecureStorage will re-check AsyncStorage this run
            }

            mmkv.set(MMKV_MIGRATION_FLAG, '1');
        } catch (e) {
            // Migration check failed; will retry on next launch
        }
    },

    // Migrates existing tokens from AsyncStorage to Keychain (runs once per install)
    migrateToSecureStorage: async (): Promise<void> => {
        if (!Keychain) return;

        try {
            // Check MMKV first, then AsyncStorage (supports installs before and after
            // migrateAsyncStorageToMMKV has forwarded the flag).
            const alreadyMigrated = mmkv.getString(MIGRATION_FLAG)
                || (await AsyncStorage.getItem(MIGRATION_FLAG));
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

            mmkv.set(MIGRATION_FLAG, '1');
            await AsyncStorage.setItem(MIGRATION_FLAG, '1');
        } catch (e) {
            // Migration check failed; will retry on next launch
        }
    },
};

export default SecureStorage;
