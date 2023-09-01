import { Redis } from 'ioredis';
import redisClient from './redisClient';
import UsersServiceStore from './UsersService';
import MapsServiceStore from './MapsService';

// TODO: Consider moving this to therr-public-library to share between services
class CacheStore {
    private cache: Redis;

    public usersService: any;

    public mapsService: any;

    constructor(cacheClient) {
        this.cache = cacheClient;
        this.usersService = new UsersServiceStore(this.cache);
        this.mapsService = new MapsServiceStore(this.cache);
    }
}

export default new CacheStore(redisClient);
