import { Redis } from 'ioredis';
import redisClient from './redisClient';
import UsersServiceStore from './UsersService';

// TODO: Consider moving this to therr-public-library to share between services
class CacheStore {
    private cache: Redis;

    public usersService: any;

    constructor(cacheClient) {
        this.cache = cacheClient;
        this.usersService = new UsersServiceStore(this.cache);
    }
}

export default new CacheStore(redisClient);
