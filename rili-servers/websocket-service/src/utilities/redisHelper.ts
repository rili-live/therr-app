
import * as Redis from 'ioredis';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import beeline from '../beeline';
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
        const userId = userSocketConfig.data.id;
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
        const userId = userSocketConfig.data.id;
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

    public removeUser = async (socketId: Redis.KeyType) => {
        const response = await this.getUserBySocketId(socketId);
        const user = response && response.user;
        const pipeline = this.client.pipeline();
        if (user && user.id) {
            pipeline.del(`users:${user.id}`);
        }
        pipeline.del(socketId);
        pipeline.exec();
    };

    public getUserById = async (userId: number): Promise<any> => {
        let userData = await this.client.get(`users:${userId}`);
        let socketId: string | null | undefined;
        userData = userData && JSON.parse(userData);

        if (userData && Object.keys(userData).length) {
            socketId = (userData as any).socketId;
            delete (userData as any).socketId;
        } else {
            return null;
        }

        return {
            user: userData,
            socketId,
        };
    };

    public getUsersById = async (users: any[]): Promise<any> => {
        const pipeline = this.client.pipeline();
        const activeUserIds: any[] = [];

        users.forEach((u) => {
            pipeline.get(`users:${u.id}`);
        });

        return pipeline.exec().then((response) => {
            response.forEach(([err, stringifiedUser]) => {
                if (err) {
                    printLogs({
                        level: 'info',
                        messageOrigin: 'REDIS_ERROR_LOGS',
                        messages: err.message,
                        tracer: beeline,
                    });
                    return;
                }
                let socketId: string | null | undefined;
                const user = stringifiedUser && JSON.parse(stringifiedUser);

                if (user && Object.keys(user).length) {
                    socketId = (user as any).socketId;
                    delete (user as any).socketId;

                    activeUserIds.push(user.id);
                }
            });

            return activeUserIds;
        });
    };

    public getUserBySocketId = async (socketId: any): Promise<any> => {
        const userId = await this.client.get(`userSockets:${socketId}`);

        if (userId) {
            return this.getUserById(Number(userId)).then((response) => response && response.user);
        }

        return null;
    };
}

export default new RedisHelper(redisPub);
