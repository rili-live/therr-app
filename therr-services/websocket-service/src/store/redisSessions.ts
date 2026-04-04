import * as globalConfig from '../../../../global-config';
import redisHelper, { IUserSocketSession, RedisHelper } from '../utilities/redisHelper';
import { UserStatus } from '../constants';

// TODO: Devise a strategy to group users in rooms (for realtime active/inactive status)
// and broadcast to a room when their status changes rather than a broadcast to all users
// SCALABILITY

const defaultExpire = Number(globalConfig[process.env.NODE_ENV || 'development'].socket.userSocketSessionExpire) / 1000;

// TODO: Determine if there is a better way to reuse connections
// For example, constructor may be creating new instance of redis client every time
/**
 * RedisSession
 */
class RedisSessions {
    private redisHelper: RedisHelper;

    constructor() {
        this.redisHelper = redisHelper;
    }

    public createOrUpdate(args: IUserSocketSession): Promise<any> {
        const configuredArgs = { // TODO: RSERV-4: Use app and ip to namespace
            // TODO: RSERV-4: Create a token to send back to the frontend
            app: args.app,
            socketId: args.socketId,
            ip: args.ip.toString(),
            ttl: args.ttl || defaultExpire,
            data: args.data,
        };

        return this.redisHelper.storeOrUpdateUser(configuredArgs).then(() => configuredArgs);
    }

    public update(args: IUserSocketSession): Promise<any> {
        const configuredArgs = { // TODO: RSERV-4: Use app and ip to namespace
            // TODO: RSERV-4: Create a token to send back to the frontend
            app: args.app,
            socketId: args.socketId,
            ip: args.ip.toString(),
            ttl: args.ttl || defaultExpire,
            data: args.data,
        };

        return this.redisHelper.updateUser(configuredArgs).then(() => configuredArgs);
    }

    public updateStatus(user, newStatus: UserStatus, ttl?): Promise<any> {
        return this.redisHelper.updateUserStatus(user, newStatus, ttl);
    }

    public remove(socketId: string) {
        return this.redisHelper.removeUser(socketId);
    }

    public getUserBySocketId(socketId: string): any {
        return this.redisHelper.getUserBySocketId(socketId);
    }

    public getUserById(userId: string): any {
        return this.redisHelper.getUserById(userId);
    }

    public getUsersByIds(users: any[]): any {
        return this.redisHelper.getUsersById(users);
    }
}

export default new RedisSessions();
