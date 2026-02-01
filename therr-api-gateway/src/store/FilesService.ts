import { Redis } from 'ioredis';

const FILES_STORE_PREFIX = 'FILES_STORE:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week
const MAX_REQUEST_TIME = 2000;

class FilesServiceCache {
    private cache: Redis;

    constructor(cacheClient) {
        this.cache = cacheClient;
    }

    public getFile(path: string) {
        return new Promise((resolve) => {
            // Prevent hang when Redis connection timeout
            setTimeout(() => resolve(undefined), MAX_REQUEST_TIME);

            this.cache.get(`${FILES_STORE_PREFIX}${path}`).then((response) => {
                if (!response) {
                    return resolve(undefined);
                }

                return resolve(Buffer.from(response, 'base64'));
            }).catch((error) => {
                console.error(`Error getting image with path ${path} from cache`, error);
                return resolve(undefined);
            });
        });
    }

    public setFile(path: string, data: Buffer, ttl = DEFAULT_TTL_SECONDS) {
        if (!path) {
            return null;
        }

        return this.cache.setex(`${FILES_STORE_PREFIX}${path}`, ttl, data.toString('base64')).catch((error) => {
            console.error(`Error setting path ${path} in cache`, error);
        });
    }

    public invalidateFile(path: string): Promise<number | null> {
        return this.cache.del(`${FILES_STORE_PREFIX}${path}`).catch((error) => {
            console.error(`Error invalidating path ${path} from cache`, error);
            return null;
        });
    }
}

export default FilesServiceCache;
