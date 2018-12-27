
import * as Redis from 'ioredis';
import promiser from 'rili-public-library/utilities/promiser'; // tslint:disable-line no-implicit-dependencies
import * as config from '../../config.js';
import { IUserSocketSession } from './redis-session';

/**
 * RedisHelper
 * redisClient: any - the ioredis client to enter redis commands
 */
export default class RedisHelper {
    private client: Redis.Redis;

    constructor(redisClient: Redis.Redis) {
        // NOTE: client should be build from ioredis
        this.client = redisClient;
    }

    public storeUser = (userSocketConfig: IUserSocketSession): Promise<any> => {
        return new Promise((resolve, reject) => {
            this.client.setex(
                userSocketConfig.socketId,
                userSocketConfig.ttl || config.userSocketSessionExpire,
                userSocketConfig.data,
                promiser(resolve, reject)
            );
        });
    };

    public getUser = (socketId: any): Promise<any> => {
        return new Promise((resolve, reject) => {
            this.client.get(socketId, promiser(resolve, reject));
        });
    };
}