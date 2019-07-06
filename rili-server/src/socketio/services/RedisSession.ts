import * as Redis from 'ioredis';
import * as globalConfig from '../../../../global-config.js';
import RedisHelper from './RedisHelper';

interface IRedisSessionArgs {
    client: Redis.Redis;
}

export interface IUserSocketSession {
    app: string;
    socketId: Redis.KeyType;
    ip: string | number;
    ttl?: number;
    data: any;
}

/**
 * RedisSession
 * redisClient: any - the client to enter redis commands
 */
export default class RedisSession {
    private client: Redis.Redis;
    private redisHelper: RedisHelper;

    constructor(args: IRedisSessionArgs) {
        this.client = args.client;
        this.redisHelper = new RedisHelper(this.client);
    }

    public create(args: IUserSocketSession): Promise<any> {
        const configuredArgs = Object.assign({}, {
            // TODO: RSERV-4: Use app and ip to namespace
            // TODO: RSERV-4: Create a token to send back to the frontend
            app: args.app,
            socketId: args.socketId,
            ip: args.ip.toString(),
            ttl: args.ttl || globalConfig[process.env.NODE_ENV].socket.userSocketSessionExpire,
            data: JSON.stringify(args.data),
        });

        return this.redisHelper.storeUser(configuredArgs).then(() => {
            return configuredArgs;
        });
    }

    public remove(socketId: Redis.KeyType) {
        return this.redisHelper.removeUser(socketId);
    }

    public get(socketId: Redis.KeyType): any {
        return this.redisHelper.getUser(socketId);
    }
}
