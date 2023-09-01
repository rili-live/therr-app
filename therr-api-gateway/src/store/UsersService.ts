import { Redis } from 'ioredis';

const USERS_STORE_PREFIX = 'USERS_STORE:';

class UsersServiceCache {
    private cache: Redis;

    constructor(cacheClient) {
        this.cache = cacheClient;
    }

    public getExchangeRate(): any {
        return this.cache.get(`${USERS_STORE_PREFIX}therrCoinExchangeRate`).catch((error) => {
            console.error('Error getting exchange rate from cache', error);
        });
    }

    // 5 minute TTL
    // TODO: Determine a better TTL for this
    public setExchangeRate(value: any, ttl = 300): Promise<'OK' | null> {
        return this.cache.setex(`${USERS_STORE_PREFIX}therrCoinExchangeRate`, ttl, value).catch((error) => {
            console.error('Error setting exchange rate in cache', error);
            return null;
        });
    }

    // TODO: Cache invalidation should be moved to a centralized base abstraction
    // layer so we can meticulously control cache invalidation and prevent user/developer error
    public invalidateExchangeRate(): Promise<number | null> {
        return this.cache.del(`${USERS_STORE_PREFIX}therrCoinExchangeRate`).catch((error) => {
            console.error('Error invalidating exchange rate cache', error);
            return null;
        });
    }
}

export default UsersServiceCache;
