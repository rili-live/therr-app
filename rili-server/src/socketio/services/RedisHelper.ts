
import * as Redis from 'ioredis';
import promiser from 'rili-public-library/utilities/promiser.js';
import * as globalConfig from '../../../../global-config.js';

export interface IUserSocketSession {
    app: string;
    socketId: Redis.KeyType;
    ip: string | number;
    ttl?: number;
    data: any;
}

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

    public storeUser = (userSocketConfig: IUserSocketSession): Promise<any> => new Promise((resolve, reject) => {
        this.client.setex(
            userSocketConfig.socketId,
            userSocketConfig.ttl || globalConfig[process.env.NODE_ENV || 'development'].socket.userSocketSessionExpire,
            userSocketConfig.data,
            promiser(resolve, reject),
        );
    });

    public removeUser = (socketId: Redis.KeyType) => new Promise((resolve, reject) => {
        this.client.del(socketId);
    })

    public getUser = (socketId: any): Promise<any> => new Promise((resolve, reject) => {
        this.client.get(socketId, promiser(resolve, reject));
    });
}
