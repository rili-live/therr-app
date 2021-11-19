import { Location } from 'therr-js-utilities/constants';
import redisClient from './redisClient';
import beeline from '../beeline';

export const USER_CACHE_TTL_SEC = 60 * 20; // 20 minutes

interface IOrigin {
    longitude: number;
    latitude: number;
}

export default class UserLocationCache {
    private keyPrefix;

    private geoKeyPrefix;

    private userId;

    public client = redisClient;

    private geoKeys: any = {};

    private keys: any = {};

    constructor(userId, callback?) {
        this.userId = userId;
        this.keyPrefix = `user:${this.userId}:nearby-moments`;
        this.geoKeyPrefix = `user:${this.userId}:nearby-moments-geo`;

        // Create Keys
        this.geoKeys.unactivated = 'unactivated';
        this.keys.origin = 'origin';
        this.keys.lastNotificationDateMs = 'lastNotificationDateMs';
        this.keys.maxActivationDistance = 'maxActivationDistance';

        const pipeline = redisClient.pipeline();
        pipeline.hset(this.keyPrefix, 'exists', 'true'); // arbitrary placeholder, allows us to expire all keys together
        pipeline.expire(this.keyPrefix, USER_CACHE_TTL_SEC);
        pipeline.exec().then(() => callback && callback());
    }

    clearCache = () => {
        const pipeline = redisClient.pipeline();

        pipeline.expire(this.keyPrefix, 0);
        pipeline.expire(this.geoKeyPrefix, 0);

        return pipeline.exec();
    };

    getOrigin = () => redisClient.hget(this.keyPrefix, this.keys.origin).then((response) => response && JSON.parse(response));

    setOrigin = (origin: IOrigin) => redisClient.hset(this.keyPrefix, this.keys.origin, JSON.stringify(origin));

    getLastNotificationDate = () => redisClient.hget(this.keyPrefix, this.keys.lastNotificationDateMs)
        .then((response) => response && Number(response))
        .catch((error) => {
            beeline.addContext({
                errorMessage: error?.stack,
                context: 'redis',
                significance: 'high error rate will cause excessive push notifications for location moment activations',
            });
        });

    setLastNotificationDate = () => redisClient.hset(this.keyPrefix, this.keys.lastNotificationDateMs, Date.now());

    getMaxActivationDistance = () => redisClient.get(`${this.keyPrefix}${this.keys.maxActivationDistance}`);

    setMaxActivationDistance = (value) => redisClient.set(`${this.keyPrefix}${this.keys.maxActivationDistance}`, value);

    addMoments = (moments: any[], loggingDetails) => {
        const pipeline: any = redisClient.pipeline();

        moments.forEach((moment) => {
            pipeline.geoadd(this.geoKeyPrefix, moment.longitude, moment.latitude, moment.id);
            pipeline.hset(`${this.geoKeyPrefix}:${this.geoKeys.unactivated}:${moment.id}`, moment);
        });

        pipeline.expire(this.geoKeyPrefix, USER_CACHE_TTL_SEC);

        return pipeline.exec()
            .then(() => {
                beeline.addContext({
                    message: 'cached nearby moments',
                    context: 'redis',
                    significance: 'moments are cached on user\'s first login and after they travel the minimum distance',
                    ...loggingDetails,
                });
            })
            .catch((error) => {
                this.clearCache(); // clear cache if having issues with caching geo coordinates
                beeline.addContext({
                    errorMessage: error?.stack,
                    context: 'redis',
                    significance: 'failing to cache moments will cause excessive database pulls and poor performance',
                    ...loggingDetails,
                });
            });
    }

    removeMoments = (momentIds: number[], loggingDetails) => {
        const pipeline = redisClient.pipeline();

        momentIds.forEach((id) => {
            pipeline.zrem(this.geoKeyPrefix, id);
            pipeline.del(`${this.geoKeyPrefix}:${this.geoKeys.unactivated}:${id}`);
        });

        return pipeline.exec()
            .catch((error) => {
                beeline.addContext({
                    errorMessage: error?.stack,
                    context: 'redis',
                    significance: 'failing to remove moments from the unactivated moments cache will prevent new moments from being activated',
                    ...loggingDetails,
                });
            });
    }

    getMomentsWithinDistance = (userLocation, radius: number, loggingDetails) => {
        const redis: any = redisClient;
        return redis.georadius(this.geoKeyPrefix, userLocation.longitude, userLocation.latitude, radius, 'm')
            .then((momentIds) => {
                const pipeline = redisClient.pipeline();

                for (let i = 0; i < Location.MAX_MOMENT_ACTIVATE_COUNT && i <= momentIds.length - 1; i += 1) {
                    if (momentIds[i]) {
                        pipeline.hgetall(`${this.geoKeyPrefix}:${this.geoKeys.unactivated}:${momentIds[i]}`);
                    }
                }

                return pipeline.exec();
            })
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .then((moments) => moments.map(([error, moment]) => ({
                ...moment,
                id: moment.id,
                fromUserId: moment.fromUserId,
                isPublic: moment.isPublic === 'true',
                maxViews: Number(moment.maxViews),
                latitude: Number(moment.latitude),
                longitude: Number(moment.longitude),
                radius: Number(moment.radius),
                maxProximity: Number(moment.maxProximity),
                doesRequireProximityToView: moment.doesRequireProximityToView === 'true',
            }))) // TODO: Verify parsing correctly parses numbers
            .catch((error) => {
                beeline.addContext({
                    errorMessage: error?.stack,
                    context: 'redis',
                    significance: 'failing to fetch moments from the cache',
                    ...loggingDetails,
                });
            });
    }

    invalidateCache = () => redisClient.del(this.keyPrefix);
}
