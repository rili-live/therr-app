import Redis from 'ioredis';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { redisPub } from '../store/redisClient';
import * as globalConfig from '../../../../global-config';

const defaultExpire = Number(globalConfig[process.env.NODE_ENV || 'development'].socket.userSocketSessionExpire) / 1000;

export interface IUserSocketSession {
    app: string;
    socketId: string;
    ip: string | number;
    ttl?: number;
    data: any;
}

/**
 * RedisHelper
 * redisClient: Redis - the ioredis client to enter redis commands
 */
export class RedisHelper {
    client: Redis;

    constructor(client: Redis) {
        this.client = client; // NOTE: client should be built from 'ioredis'
    }

    public storeOrUpdateUser = async (userSocketConfig: IUserSocketSession): Promise<any> => {
        const userId = userSocketConfig.data.id;
        const ttl = userSocketConfig.ttl || defaultExpire;
        const pipeline = this.client.pipeline();

        const existingUser = await this.getUserById(userSocketConfig.data.id);

        if (existingUser) {
            return this.updateUser(userSocketConfig);
        }

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
        const ttl = userSocketConfig.ttl || defaultExpire;
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

    public updateUserStatus = async (user, newStatus, newTtl?) => {
        const ttl = newTtl || defaultExpire;

        return this.client.setex(
            `users:${user.id}`,
            ttl,
            JSON.stringify({
                ...user,
                status: newStatus,
            }),
        );
    };

    public removeUser = async (socketId: string) => {
        const user = await this.getUserBySocketId(socketId);
        const pipeline = this.client.pipeline();
        if (user && user.id) {
            pipeline.del(`users:${user.id}`);
        }
        pipeline.del(`userSockets:${socketId}`);
        pipeline.exec();
    };

    public getUserById = async (userId: string): Promise<any> => {
        let userData = await this.client.get(`users:${userId}`);
        let socketId: string | null | undefined;
        userData = userData && JSON.parse(userData);

        if (userData && Object.keys(userData).length) {
            socketId = (userData as any).socketId;
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
        const activeUsers: any[] = [];

        users.forEach((u) => {
            pipeline.get(`users:${u.id}`);
        });

        return pipeline.exec().then((response) => {
            if (!response) return activeUsers;
            response.forEach(([err, stringifiedUser]) => {
                if (err) {
                    logSpan({
                        level: 'info',
                        messageOrigin: 'REDIS_ERROR_LOGS',
                        messages: err.message,
                    });
                    return;
                }
                let socketId: string | null | undefined;
                const user = stringifiedUser && JSON.parse(stringifiedUser as string);

                if (user && Object.keys(user).length) {
                    socketId = (user as any).socketId;
                    delete user.idToken;
                    activeUsers.push({ ...user });
                }
            });

            return activeUsers;
        });
    };

    public getUserBySocketId = async (socketId: any): Promise<any> => {
        const userId = await this.client.get(`userSockets:${socketId}`);

        if (userId) {
            return this.getUserById(userId).then((response) => response?.user);
        }

        return null;
    };

    public throttleDmNotifications = async (toUserId, fromUser): Promise<boolean> => {
        const key = `dmNotificationThrottles:${toUserId}:${fromUser}`;
        return this.shouldCreateNotification(key);
    };

    public throttleReactionNotifications = async (toUserId, fromUser): Promise<boolean> => {
        const key = `reactionNotificationThrottles:${toUserId}:${fromUser}`;
        return this.shouldCreateNotification(key, 60);
    };

    public shouldCreateNotification = async (key: string, minWaitSeconds: number = 60 * 20): Promise<boolean> => {
        const doesLockExist = await this.client.get(key);
        if (doesLockExist) {
            return false;
        }
        this.client.setex(key, minWaitSeconds, 1); // 20 minute expire
        return true;
    };
}

export default new RedisHelper(redisPub);
