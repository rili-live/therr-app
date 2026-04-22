import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock react-native-keychain
const mockSetInternetCredentials = jest.fn().mockResolvedValue(true);
const mockGetInternetCredentials = jest.fn();
const mockResetInternetCredentials = jest.fn().mockResolvedValue(true);

jest.mock('react-native-keychain', () => ({
    setInternetCredentials: (...args: any[]) => mockSetInternetCredentials(...args),
    getInternetCredentials: (...args: any[]) => mockGetInternetCredentials(...args),
    resetInternetCredentials: (...args: any[]) => mockResetInternetCredentials(...args),
}));

// Mock react-native-mmkv with an in-memory backing store
const mmkvStore: Record<string, string> = {};
const mockMmkvSet = jest.fn((key: string, value: string) => { mmkvStore[key] = value; });
const mockMmkvGetString = jest.fn((key: string) => mmkvStore[key]);
const mockMmkvDelete = jest.fn((key: string) => { delete mmkvStore[key]; });

jest.mock('react-native-mmkv', () => ({
    MMKV: jest.fn().mockImplementation(() => ({
        set: (k: string, v: string) => mockMmkvSet(k, v),
        getString: (k: string) => mockMmkvGetString(k),
        delete: (k: string) => mockMmkvDelete(k),
    })),
}));

// Import after mocks
import SecureStorage from '../../main/utilities/SecureStorage';

beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
    (AsyncStorage.multiRemove as jest.Mock).mockReset();
    Object.keys(mmkvStore).forEach((k) => delete mmkvStore[k]);
});

describe('SecureStorage', () => {
    describe('setItem', () => {
        it('stores secure keys in Keychain', async () => {
            await SecureStorage.setItem('therrRefreshToken', 'my-token');

            expect(mockSetInternetCredentials).toHaveBeenCalledWith(
                'therrRefreshToken',
                'therrRefreshToken',
                'my-token',
                { service: 'therr-secure-storage' },
            );
            // Should NOT also write to MMKV or AsyncStorage
            expect(mockMmkvSet).not.toHaveBeenCalled();
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });

        it('stores therrUser in Keychain', async () => {
            const userData = JSON.stringify({ id: '1', idToken: 'tok' });
            await SecureStorage.setItem('therrUser', userData);

            expect(mockSetInternetCredentials).toHaveBeenCalledWith(
                'therrUser',
                'therrUser',
                userData,
                { service: 'therr-secure-storage' },
            );
        });

        it('stores non-secure keys in MMKV', async () => {
            await SecureStorage.setItem('therrSession', 'session-data');

            expect(mockSetInternetCredentials).not.toHaveBeenCalled();
            expect(mockMmkvSet).toHaveBeenCalledWith('therrSession', 'session-data');
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });

        it('falls back to MMKV when Keychain setItem throws', async () => {
            mockSetInternetCredentials.mockRejectedValueOnce(new Error('Keychain error'));

            await SecureStorage.setItem('therrRefreshToken', 'my-token');

            expect(mockMmkvSet).toHaveBeenCalledWith('therrRefreshToken', 'my-token');
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('getItem', () => {
        it('reads secure keys from Keychain', async () => {
            mockGetInternetCredentials.mockResolvedValueOnce({ password: 'stored-token' });

            const result = await SecureStorage.getItem('therrRefreshToken');

            expect(result).toBe('stored-token');
            expect(mockMmkvGetString).not.toHaveBeenCalled();
            expect(AsyncStorage.getItem).not.toHaveBeenCalled();
        });

        it('falls through to MMKV when Keychain returns nothing', async () => {
            mockGetInternetCredentials.mockResolvedValueOnce(false);
            mmkvStore.therrRefreshToken = 'mmkv-stored-token';

            const result = await SecureStorage.getItem('therrRefreshToken');

            expect(result).toBe('mmkv-stored-token');
            expect(AsyncStorage.getItem).not.toHaveBeenCalled();
        });

        it('falls through to AsyncStorage when Keychain and MMKV both miss (pre-migration)', async () => {
            mockGetInternetCredentials.mockResolvedValueOnce(false);
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('async-stored-token');

            const result = await SecureStorage.getItem('therrRefreshToken');

            expect(result).toBe('async-stored-token');
        });

        it('falls through to MMKV/AsyncStorage when Keychain throws', async () => {
            mockGetInternetCredentials.mockRejectedValueOnce(new Error('Keychain error'));
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('fallback-token');

            const result = await SecureStorage.getItem('therrRefreshToken');

            expect(result).toBe('fallback-token');
        });

        it('reads non-secure keys from MMKV first', async () => {
            mmkvStore.therrSession = 'mmkv-session-data';

            const result = await SecureStorage.getItem('therrSession');

            expect(mockGetInternetCredentials).not.toHaveBeenCalled();
            expect(result).toBe('mmkv-session-data');
            expect(AsyncStorage.getItem).not.toHaveBeenCalled();
        });

        it('falls back to AsyncStorage for non-secure keys when MMKV is empty', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('legacy-session-data');

            const result = await SecureStorage.getItem('therrSession');

            expect(result).toBe('legacy-session-data');
        });
    });

    describe('removeItem', () => {
        it('removes secure keys from Keychain, MMKV, and AsyncStorage', async () => {
            await SecureStorage.removeItem('therrRefreshToken');

            expect(mockResetInternetCredentials).toHaveBeenCalledWith('therrRefreshToken');
            expect(mockMmkvDelete).toHaveBeenCalledWith('therrRefreshToken');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('therrRefreshToken');
        });

        it('removes non-secure keys from MMKV and AsyncStorage', async () => {
            await SecureStorage.removeItem('therrSession');

            expect(mockResetInternetCredentials).not.toHaveBeenCalled();
            expect(mockMmkvDelete).toHaveBeenCalledWith('therrSession');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('therrSession');
        });
    });

    describe('multiRemove', () => {
        it('removes mixed secure and non-secure keys from all backing stores', async () => {
            await SecureStorage.multiRemove(['therrRefreshToken', 'therrSession']);

            expect(mockResetInternetCredentials).toHaveBeenCalledWith('therrRefreshToken');
            expect(mockResetInternetCredentials).not.toHaveBeenCalledWith('therrSession');
            expect(mockMmkvDelete).toHaveBeenCalledWith('therrRefreshToken');
            expect(mockMmkvDelete).toHaveBeenCalledWith('therrSession');
            expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['therrRefreshToken', 'therrSession']);
        });
    });

    describe('migrateAsyncStorageToMMKV', () => {
        it('copies non-secure keys from AsyncStorage into MMKV and sets the flag', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce('session-value') // therrSession
                .mockResolvedValueOnce('settings-value') // therrUserSettings
                .mockResolvedValueOnce(null); // therr_secure_migration_v1

            await SecureStorage.migrateAsyncStorageToMMKV();

            expect(mockMmkvSet).toHaveBeenCalledWith('therrSession', 'session-value');
            expect(mockMmkvSet).toHaveBeenCalledWith('therrUserSettings', 'settings-value');
            expect(mockMmkvSet).toHaveBeenCalledWith('therr_mmkv_migration_v1', '1');
        });

        it('is a no-op when the MMKV migration flag is already set', async () => {
            mmkvStore.therr_mmkv_migration_v1 = '1';

            await SecureStorage.migrateAsyncStorageToMMKV();

            expect(AsyncStorage.getItem).not.toHaveBeenCalled();
            expect(mockMmkvSet).not.toHaveBeenCalled();
        });

        it('skips missing keys but still sets the flag', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce(null) // therrSession
                .mockResolvedValueOnce(null) // therrUserSettings
                .mockResolvedValueOnce(null); // therr_secure_migration_v1

            await SecureStorage.migrateAsyncStorageToMMKV();

            expect(mockMmkvSet).toHaveBeenCalledTimes(1);
            expect(mockMmkvSet).toHaveBeenCalledWith('therr_mmkv_migration_v1', '1');
        });

        it('forwards the Keychain-migration flag into MMKV when present in AsyncStorage', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce(null) // therrSession
                .mockResolvedValueOnce(null) // therrUserSettings
                .mockResolvedValueOnce('1'); // therr_secure_migration_v1

            await SecureStorage.migrateAsyncStorageToMMKV();

            expect(mockMmkvSet).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
            expect(mockMmkvSet).toHaveBeenCalledWith('therr_mmkv_migration_v1', '1');
        });
    });

    describe('migrateToSecureStorage', () => {
        it('migrates existing AsyncStorage keys to Keychain', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce(null) // MIGRATION_FLAG not set (AsyncStorage check)
                .mockResolvedValueOnce('refresh-token-value') // therrRefreshToken
                .mockResolvedValueOnce('user-json-value'); // therrUser

            await SecureStorage.migrateToSecureStorage();

            expect(mockSetInternetCredentials).toHaveBeenCalledTimes(2);
            expect(mockSetInternetCredentials).toHaveBeenCalledWith(
                'therrRefreshToken',
                'therrRefreshToken',
                'refresh-token-value',
                { service: 'therr-secure-storage' },
            );
            expect(mockSetInternetCredentials).toHaveBeenCalledWith(
                'therrUser',
                'therrUser',
                'user-json-value',
                { service: 'therr-secure-storage' },
            );
            expect(mockMmkvSet).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
        });

        it('skips migration if flag is set in MMKV', async () => {
            mmkvStore.therr_secure_migration_v1 = '1';

            await SecureStorage.migrateToSecureStorage();

            expect(AsyncStorage.getItem).not.toHaveBeenCalled();
            expect(mockSetInternetCredentials).not.toHaveBeenCalled();
        });

        it('skips migration if flag is set in AsyncStorage (MMKV empty)', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('1');

            await SecureStorage.migrateToSecureStorage();

            expect(mockSetInternetCredentials).not.toHaveBeenCalled();
        });

        it('skips keys that are not in AsyncStorage', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce(null) // MIGRATION_FLAG
                .mockResolvedValueOnce(null) // therrRefreshToken not found
                .mockResolvedValueOnce(null); // therrUser not found

            await SecureStorage.migrateToSecureStorage();

            expect(mockSetInternetCredentials).not.toHaveBeenCalled();
            // Should still set the migration flag in both stores
            expect(mockMmkvSet).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
        });

        it('sets migration flag even if individual key migration fails', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce(null) // MIGRATION_FLAG
                .mockResolvedValueOnce('token-value') // therrRefreshToken
                .mockResolvedValueOnce('user-value'); // therrUser

            mockSetInternetCredentials
                .mockRejectedValueOnce(new Error('Keychain write failed'))
                .mockResolvedValueOnce(true);

            await SecureStorage.migrateToSecureStorage();

            // Second key should still migrate
            expect(mockSetInternetCredentials).toHaveBeenCalledTimes(2);
            // Migration flag should still be set in both stores
            expect(mockMmkvSet).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
        });
    });
});
