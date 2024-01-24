import { Redis } from 'ioredis';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IAreaType } from 'therr-js-utilities/types';

const MAPS_STORE_PREFIX = 'MAPS_STORE:';
const DEFAULT_TTL_SECONDS = 300;

class MapsServiceCache {
    private cache: Redis;

    constructor(cacheClient) {
        this.cache = cacheClient;
    }

    public getAreaDetails(areaType: IAreaType, areaId: string) {
        return this.cache.get(`${MAPS_STORE_PREFIX}${areaType}:${areaId}`).then((response) => {
            if (!response) {
                return undefined;
            }

            return JSON.parse(response);
        }).catch((error) => {
            console.error(`Error getting ${areaType} from cache`, error);
        });
    }

    public setAreaDetails(areaType: IAreaType, data: any, ttl = DEFAULT_TTL_SECONDS) {
        let areaId = data?.moment?.id;
        if (areaType === 'events') {
            areaId = data?.event?.id;
        }
        if (areaType === 'spaces') {
            areaId = data?.space?.id;
        }

        if (!areaId) {
            return null;
        }

        return this.cache.setex(`${MAPS_STORE_PREFIX}${areaType}:${areaId}`, ttl, JSON.stringify(data)).catch((error) => {
            console.error(`Error setting ${areaType} in cache`, error);
        });
    }

    // TODO: Cache invalidation should be moved to a centralized base abstraction
    // layer so we can meticulously control cache invalidation and prevent user/developer error
    public invalidateAreaDetails(areaType: IAreaType, areaId: string): Promise<number | null> {
        return this.cache.del(`${MAPS_STORE_PREFIX}${areaType}:${areaId}`).catch((error) => {
            console.error(`Error invalidating ${areaType} cache`, error);
            return null;
        });
    }
}

export default MapsServiceCache;
