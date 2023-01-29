import { Redis } from 'ioredis';

const USERS_STORE_PREFIX = 'USERS_STORE:';

class UsersServiceCache {
    private cache: Redis;

    constructor(cacheClient) {
        this.cache = cacheClient;
    }

    public getExchangeRate(): any {
        return this.cache.get(`${USERS_STORE_PREFIX}therrCoinExchangeRate`);
    }

    // 30 minute TTL
    // TODO: Determine a better TTL for this
    public setExchangeRate(value: any, ttl = 1800): Promise<'OK'> {
        return this.cache.setex(`${USERS_STORE_PREFIX}therrCoinExchangeRate`, ttl, value);
    }

    // TODO: Cache invalidation should be moved to a centralized base abstraction
    // layer so we can meticulously control cache invalidation and prevent user/developer error
    public invalidateExchangeRate(): Promise<number> {
        return this.cache.del(`${USERS_STORE_PREFIX}therrCoinExchangeRate`);
    }
}

export default UsersServiceCache;
