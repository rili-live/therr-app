
import * as Redis from 'ioredis';
import redisClient from '../store/redisClient';
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
        this.client = client; // NOTE: client should be build from 'ioredis'
    }

    // TODO: RSERV-26 - Optimize with pipelines
    public storeUser = async (userSocketConfig: IUserSocketSession): Promise<any> => {
        const userId = userSocketConfig.data.id;
        const ttl = userSocketConfig.ttl || globalConfig[process.env.NODE_ENV || 'development'].socket.userSocketSessionExpire;

        await this.client.setex(`userSockets:${userSocketConfig.socketId}:socketId`, ttl, userId);

        return this.client.setex(
            `users:${userId}`,
            ttl,
            JSON.stringify({
                ...userSocketConfig.data,
                socketId: userSocketConfig.socketId,
            }),
        );
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
        const userId = await this.client.get(`userSockets:${socketId}:socketId`);
        return this.client.get(`users:${userId}`);
    };
}

export default new RedisHelper(redisClient);
