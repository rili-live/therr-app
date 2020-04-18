
import * as Redis from 'ioredis';
import { redisPub } from '../store/redisClient';
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
 * redisClient: Redis.Redis - the ioredis client to enter redis commands
 */
export class RedisHelper {
    client: Redis.Redis;

    constructor(client: Redis.Redis) {
        this.client = client; // NOTE: client should be built from 'ioredis'
    }

    public storeUser = async (userSocketConfig: IUserSocketSession): Promise<any> => {
        const userId = userSocketConfig.data.userId;
        const ttl = userSocketConfig.ttl || globalConfig[process.env.NODE_ENV || 'development'].socket.userSocketSessionExpire;
        const pipeline = this.client.pipeline();

        pipeline.setex(`userSockets:${userSocketConfig.socketId}`, ttl, userId);

        pipeline.setex(
            `users:${userId}`,
            ttl,
            JSON.stringify({
                ...userSocketConfig.data,
                socketId: userSocketConfig.socketId,
            }),
        );

        return pipeline.exec();
    };

    public updateUser = async (userSocketConfig: IUserSocketSession): Promise<any> => {
        const userId = userSocketConfig.data.userId;
        const ttl = userSocketConfig.ttl || globalConfig[process.env.NODE_ENV || 'development'].socket.userSocketSessionExpire;
        const prevSocketId = userSocketConfig.data.previousSocketId;
        const pipeline = this.client.pipeline();

        pipeline.del(`userSockets:${prevSocketId}`);
        pipeline.setex(`userSockets:${userSocketConfig.socketId}`, ttl, userId);

        // Updates the socketId
        pipeline.setex(
            `users:${userId}`,
            ttl,
            JSON.stringify({
                ...userSocketConfig.data,
                socketId: userSocketConfig.socketId,
            }),
        );

        return pipeline.exec();
    };

    public removeUser = (socketId: Redis.KeyType) => this.client.del(socketId);

    public getUserById = async (userId: number): Promise<any> => {
        let userData = await this.client.get(`users:${userId}`);
        let socketId: string | null | undefined;
        userData = userData && JSON.parse(userData);

        if (userData && Object.keys(userData).length) {
            socketId = (userData as any).socketId;
            delete (userData as any).socketId;
        }

        return {
            user: userData,
            socketId,
        };
    };

    public getUserBySocketId = async (socketId: any): Promise<any> => {
        const userId = await this.client.get(`userSockets:${socketId}`);
        return this.client.get(`users:${userId}`);
    };
}

export default new RedisHelper(redisPub);
