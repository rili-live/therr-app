import * as Redis from 'ioredis';
import * as globalConfig from '../../../../global-config.js';
import redisHelper, { IUserSocketSession, RedisHelper } from '../services/redisHelper';

/**
 * RedisSession
 */
class RedisSessions {
    private redisHelper: RedisHelper;

    constructor() {
        this.redisHelper = redisHelper;
    }

    public create(args: IUserSocketSession): Promise<any> {
        const configuredArgs = { // TODO: RSERV-4: Use app and ip to namespace
            // TODO: RSERV-4: Create a token to send back to the frontend
            app: args.app,
            socketId: args.socketId,
            ip: args.ip.toString(),
            ttl: args.ttl || globalConfig[process.env.NODE_ENV || ''].socket.userSocketSessionExpire,
            data: args.data,
        };

        return this.redisHelper.storeUser(configuredArgs).then(() => configuredArgs);
    }

    public remove(socketId: Redis.KeyType) {
        return this.redisHelper.removeUser(socketId);
    }

    public getBySocketId(socketId: Redis.KeyType): any {
        return this.redisHelper.getUserBySocketId(socketId);
    }

    public getByUserId(userId: number): any {
        return this.redisHelper.getUserById(userId);
    }
}

export default new RedisSessions();
