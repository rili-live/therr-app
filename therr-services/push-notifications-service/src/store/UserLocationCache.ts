/* eslint-disable lines-between-class-members */
import { Location } from 'therr-js-utilities/constants';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IAreaType } from 'therr-js-utilities/types';
import logSpan from 'therr-js-utilities/log-or-update-span';
import redisClient from './redisClient';

export const USER_CACHE_TTL_SEC = 60 * 20; // 20 minutes

interface IOrigin {
    longitude: number;
    latitude: number;
}

export default class UserLocationCache {
    private momentsKeyPrefix;
    private momentsGeoKeyPrefix;
    private spacesKeyPrefix;
    private spacesGeoKeyPrefix;
    public client = redisClient;
    private geoKeys: any = {};
    private keys: any = {};
    private userId;

    constructor(userId, callback?) {
        this.userId = userId;
        this.momentsKeyPrefix = `user:${this.userId}:nearby-moments`;
        this.momentsGeoKeyPrefix = `user:${this.userId}:nearby-moments-geo`;
        this.spacesKeyPrefix = `user:${this.userId}:nearby-spaces`;
        this.spacesGeoKeyPrefix = `user:${this.userId}:nearby-spaces-geo`;

        // Create Keys
        this.geoKeys.unactivated = 'unactivated';
        this.keys.origin = 'origin';
        this.keys.lastNotificationDateMs = 'lastNotificationDateMs';
        this.keys.maxActivationDistance = 'maxActivationDistance';

        const pipeline = redisClient.pipeline();
        pipeline.hset(this.momentsKeyPrefix, 'exists', 'true'); // arbitrary placeholder, allows us to expire all keys together
        pipeline.expire(this.momentsKeyPrefix, USER_CACHE_TTL_SEC);
        pipeline.hset(this.spacesKeyPrefix, 'exists', 'true'); // arbitrary placeholder, allows us to expire all keys together
        pipeline.expire(this.spacesKeyPrefix, USER_CACHE_TTL_SEC);
        pipeline.exec().then(() => callback && callback()).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [''],
                traceArgs: {
                    'error.message': err?.message,
                    'error.stack': err?.stack,
                    context: 'redis',
                    source: 'UserLocationCache',
                },
            });
        });
    }

    clearCache = (): Promise<[Error | null, any][] | null> => {
        const pipeline = redisClient.pipeline();

        pipeline.expire(this.momentsKeyPrefix, 0);
        pipeline.expire(this.momentsGeoKeyPrefix, 0);
        pipeline.expire(this.spacesKeyPrefix, 0);
        pipeline.expire(this.spacesGeoKeyPrefix, 0);

        return pipeline.exec().catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [''],
                traceArgs: {
                    'error.message': err?.message,
                    'error.stack': err?.stack,
                    context: 'redis',
                    source: 'UserLocationCache.clearCache',
                },
            });
            return [];
        });
    };

    // Stored on moments hset, although could just as well be stored on spaces hset
    getOrigin = () => redisClient.hget(this.momentsKeyPrefix, this.keys.origin)
        .then((response) => response && JSON.parse(response))
        .catch((err) => logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [''],
            traceArgs: {
                'error.message': err?.message,
                'error.stack': err?.stack,
                context: 'redis',
                source: 'UserLocationCache.getOrigin',
            },
        }));

    // Stored on moments hset, although could just as well be stored on spaces hset
    setOrigin = (origin: IOrigin) => redisClient.hset(this.momentsKeyPrefix, this.keys.origin, JSON.stringify(origin)).catch((err) => logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: [''],
        traceArgs: {
            'error.message': err?.message,
            'error.stack': err?.stack,
            context: 'redis',
            source: 'UserLocationCache.setOrigin',
        },
    }));

    invalidateCache = () => {
        const pipeline = redisClient.pipeline();

        pipeline.del(this.momentsKeyPrefix);
        pipeline.del(this.spacesKeyPrefix);

        return pipeline.exec().catch((err) => logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [''],
            traceArgs: {
                'error.message': err?.message,
                'error.stack': err?.stack,
                context: 'redis',
                source: 'UserLocationCache.invalidateCache',
            },
        }));
    };

    getLastAreaNotificationDate = (areaType: IAreaType, keyPrefix: string) => redisClient.hget(keyPrefix, this.keys.lastNotificationDateMs)
        .then((response) => response && Number(response))
        .catch((error) => {
            const areaTypeSingular = areaType === 'moments' ? 'moment' : 'space';
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [`high error rate will cause excessive push notifications for location ${areaTypeSingular} activations`],
                traceArgs: {
                    'error.message': error?.message,
                    'error.stack': error?.stack,
                    context: 'redis',
                },
            });
        });

    setLastAreaNotificationDate = (keyPrefix: string) => redisClient.hset(keyPrefix, this.keys.lastNotificationDateMs, Date.now())
        .catch((error) => logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [],
            traceArgs: {
                'error.message': error?.message,
                'error.stack': error?.stack,
                context: 'redis',
                source: 'UserLocationCache.setLastAreaNotificationDate',
            },
        }));

    getMaxAreaActivationDistance = (keyPrefix: string) => redisClient.get(`${keyPrefix}${this.keys.maxActivationDistance}`).catch((error) => logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: [],
        traceArgs: {
            'error.message': error?.message,
            'error.stack': error?.stack,
            context: 'redis',
            source: 'UserLocationCache.getMaxAreaActivationDistance',
        },
    }));

    setMaxAreaActivationDistance = (keyPrefix: string, value) => redisClient.set(`${keyPrefix}${this.keys.maxActivationDistance}`, value)
        .catch((error) => logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [],
            traceArgs: {
                'error.message': error?.message,
                'error.stack': error?.stack,
                context: 'redis',
                source: 'UserLocationCache.setMaxAreaActivationDistance',
            },
        }));

    addAreas = (areaType: IAreaType, geoKeyPrefix: string, areas: any[], loggingDetails) => {
        const pipeline: any = redisClient.pipeline();

        areas.forEach((area) => {
            pipeline.geoadd(geoKeyPrefix, area.longitude, area.latitude, area.id);
            pipeline.hset(`${geoKeyPrefix}:${this.geoKeys.unactivated}:${area.id}`, area);
        });

        pipeline.expire(geoKeyPrefix, USER_CACHE_TTL_SEC);

        return pipeline.exec()
            .then(() => {
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: [`${areaType} are cached on user's first login and after they travel the minimum distance`],
                    traceArgs: {
                        message: `cached nearby ${areaType}`,
                        context: 'redis',
                        source: 'UserLocationCache.setMaxAreaActivationDistance',
                        'user.locale': loggingDetails.locale,
                        'user.deviceToken': loggingDetails.userDeviceToken,
                        'user.id': loggingDetails.userId,
                    },
                });
            })
            .catch((error) => {
                this.clearCache(); // clear cache if having issues with caching geo coordinates
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [`failing to cache ${areaType} will cause excessive database pulls and poor performance`],
                    traceArgs: {
                        'error.message': error?.message,
                        'error.stack': error?.stack,
                        message: `cached nearby ${areaType}`,
                        context: 'redis',
                        'user.locale': loggingDetails.locale,
                        'user.deviceToken': loggingDetails.userDeviceToken,
                        'user.id': loggingDetails.userId,
                    },
                });
            });
    };

    removeAreas = (areaType: IAreaType, geoKeyPrefix: string, areaIds: string[], loggingDetails) => {
        const pipeline = redisClient.pipeline();

        areaIds.forEach((id) => {
            pipeline.zrem(geoKeyPrefix, id);
            pipeline.del(`${geoKeyPrefix}:${this.geoKeys.unactivated}:${id}`);
        });

        return pipeline.exec()
            .catch((error) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [`failing to remove ${areaType} from the unactivated ${areaType} cache will prevent new ${areaType} from being activated`],
                    traceArgs: {
                        'error.message': error?.message,
                        'error.stack': error?.stack,
                        context: 'redis',
                        'user.locale': loggingDetails.locale,
                        'user.deviceToken': loggingDetails.userDeviceToken,
                        'user.id': loggingDetails.userId,
                    },
                });
            });
    };

    getAreasWithinDistance = (areaType: IAreaType, geoKeyPrefix: string, userLocation, radius: number, loggingDetails) => {
        const redis: any = redisClient;
        return redis.georadius(geoKeyPrefix, userLocation.longitude, userLocation.latitude, radius, 'm')
            .then((areaIds) => {
                const pipeline = redisClient.pipeline();

                for (let i = 0; i < Location.MAX_AREA_ACTIVATE_COUNT && i <= areaIds.length - 1; i += 1) {
                    if (areaIds[i]) {
                        pipeline.hgetall(`${geoKeyPrefix}:${this.geoKeys.unactivated}:${areaIds[i]}`);
                    }
                }

                return pipeline.exec();
            })
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .then((areas) => areas.map(([error, area]) => ({
                ...area,
                id: area.id,
                fromUserId: area.fromUserId,
                isPublic: area.isPublic === 'true',
                maxViews: Number(area.maxViews),
                latitude: Number(area.latitude),
                longitude: Number(area.longitude),
                radius: Number(area.radius),
                maxProximity: Number(area.maxProximity),
                doesRequireProximityToView: area.doesRequireProximityToView === 'true',
            }))) // TODO: Verify parsing correctly parses numbers
            .catch((error) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [`failing to fetch ${areaType} from the cache`],
                    traceArgs: {
                        'error.message': error?.message,
                        'error.stack': error?.stack,
                        context: 'redis',
                        'user.locale': loggingDetails.locale,
                        'user.deviceToken': loggingDetails.userDeviceToken,
                        'user.id': loggingDetails.userId,
                    },
                });
            });
    };

    // Moments
    getLastMomentNotificationDate = () => this.getLastAreaNotificationDate('moments', this.momentsKeyPrefix);

    setLastMomentNotificationDate = () => this.setLastAreaNotificationDate(this.keys.momentsKeyPrefix);

    getMaxMomentActivationDistance = () => this.getMaxAreaActivationDistance(this.momentsKeyPrefix);

    setMaxMomentActivationDistance = (value) => this.setMaxAreaActivationDistance(this.momentsKeyPrefix, value);

    addMoments = (areas: any[], loggingDetails) => this.addAreas('moments', this.momentsGeoKeyPrefix, areas, loggingDetails);

    removeMoments = (momentIds: string[], loggingDetails) => this.removeAreas('moments', this.momentsGeoKeyPrefix, momentIds, loggingDetails);

    getMomentsWithinDistance = (userLocation, radius: number, loggingDetails) => this
        .getAreasWithinDistance('moments', this.momentsGeoKeyPrefix, userLocation, radius, loggingDetails);

    // Spaces
    getLastSpaceNotificationDate = () => this.getLastAreaNotificationDate('spaces', this.spacesKeyPrefix);

    setLastSpaceNotificationDate = () => this.setLastAreaNotificationDate(this.keys.spacesKeyPrefix);

    getMaxSpaceActivationDistance = () => this.getMaxAreaActivationDistance(this.spacesKeyPrefix);

    setMaxSpaceActivationDistance = (value) => this.setMaxAreaActivationDistance(this.spacesKeyPrefix, value);

    addSpaces = (areas: any[], loggingDetails) => this.addAreas('spaces', this.spacesGeoKeyPrefix, areas, loggingDetails);

    removeSpaces = (momentIds: string[], loggingDetails) => this.removeAreas('spaces', this.spacesGeoKeyPrefix, momentIds, loggingDetails);

    getSpacesWithinDistance = (userLocation, radius: number, loggingDetails) => this
        .getAreasWithinDistance('spaces', this.spacesGeoKeyPrefix, userLocation, radius, loggingDetails);
}
