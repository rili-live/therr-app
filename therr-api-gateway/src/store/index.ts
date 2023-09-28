import { Redis } from 'ioredis';
import redisClient, { redisEphemeralClient } from './redisClient';
import FilesServiceStore from './FilesService';
import UsersServiceStore from './UsersService';
import MapsServiceStore from './MapsService';

// TODO: Consider moving this to therr-public-library to share between services
class CacheStore {
    private cache: Redis;

    private ephemeralCache: Redis;

    public filesService: FilesServiceStore;

    public usersService: UsersServiceStore;

    public mapsService: MapsServiceStore;

    constructor(cacheClient, ephemeralClient) {
        this.cache = cacheClient;
        this.ephemeralCache = ephemeralClient;
        this.filesService = new FilesServiceStore(this.ephemeralCache);
        this.usersService = new UsersServiceStore(this.cache);
        this.mapsService = new MapsServiceStore(this.cache);
    }
}

export default new CacheStore(redisClient, redisEphemeralClient);
