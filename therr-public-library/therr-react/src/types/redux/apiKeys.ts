export interface IApiKey {
    id: string;
    userId: string;
    keyPrefix: string;
    name: string | null;
    accessLevels: string[];
    isValid: boolean;
    createdAt: string;
    lastAccessed: string | null;
}

export interface IApiKeysState {
    apiKeys: IApiKey[];
}

export enum ApiKeyActionTypes {
    GET_API_KEYS = 'GET_API_KEYS',
    CREATE_API_KEY = 'CREATE_API_KEY',
    REVOKE_API_KEY = 'REVOKE_API_KEY',
}
