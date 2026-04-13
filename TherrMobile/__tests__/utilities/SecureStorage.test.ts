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

// Import after mocks
import SecureStorage from '../../main/utilities/SecureStorage';

beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
    (AsyncStorage.multiRemove as jest.Mock).mockReset();
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
            // Should NOT also write to AsyncStorage
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

        it('stores non-secure keys in AsyncStorage', async () => {
            await SecureStorage.setItem('therrSession', 'session-data');

            expect(mockSetInternetCredentials).not.toHaveBeenCalled();
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('therrSession', 'session-data');
        });

        it('falls back to AsyncStorage when Keychain setItem throws', async () => {
            mockSetInternetCredentials.mockRejectedValueOnce(new Error('Keychain error'));

            await SecureStorage.setItem('therrRefreshToken', 'my-token');

            expect(AsyncStorage.setItem).toHaveBeenCalledWith('therrRefreshToken', 'my-token');
        });
    });

    describe('getItem', () => {
        it('reads secure keys from Keychain', async () => {
            mockGetInternetCredentials.mockResolvedValueOnce({ password: 'stored-token' });

            const result = await SecureStorage.getItem('therrRefreshToken');

            expect(result).toBe('stored-token');
            expect(AsyncStorage.getItem).not.toHaveBeenCalled();
        });

        it('falls through to AsyncStorage when Keychain returns nothing (pre-migration)', async () => {
            mockGetInternetCredentials.mockResolvedValueOnce(false);
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('async-stored-token');

            const result = await SecureStorage.getItem('therrRefreshToken');

            expect(result).toBe('async-stored-token');
        });

        it('falls through to AsyncStorage when Keychain throws', async () => {
            mockGetInternetCredentials.mockRejectedValueOnce(new Error('Keychain error'));
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('fallback-token');

            const result = await SecureStorage.getItem('therrRefreshToken');

            expect(result).toBe('fallback-token');
        });

        it('reads non-secure keys from AsyncStorage only', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('session-data');

            const result = await SecureStorage.getItem('therrSession');

            expect(mockGetInternetCredentials).not.toHaveBeenCalled();
            expect(result).toBe('session-data');
        });
    });

    describe('removeItem', () => {
        it('removes secure keys from both Keychain and AsyncStorage', async () => {
            await SecureStorage.removeItem('therrRefreshToken');

            expect(mockResetInternetCredentials).toHaveBeenCalledWith('therrRefreshToken');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('therrRefreshToken');
        });

        it('removes non-secure keys from AsyncStorage only', async () => {
            await SecureStorage.removeItem('therrSession');

            expect(mockResetInternetCredentials).not.toHaveBeenCalled();
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('therrSession');
        });
    });

    describe('migrateToSecureStorage', () => {
        it('migrates existing AsyncStorage keys to Keychain', async () => {
            (AsyncStorage.getItem as jest.Mock)
                .mockResolvedValueOnce(null) // MIGRATION_FLAG not set
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
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
        });

        it('skips migration if already done', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('1'); // MIGRATION_FLAG already set

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
            // Should still set the migration flag
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
            // Migration flag should still be set
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('therr_secure_migration_v1', '1');
        });
    });
});
