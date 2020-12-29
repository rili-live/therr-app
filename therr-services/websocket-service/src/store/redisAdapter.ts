import { createAdapter } from 'socket.io-redis';
import { redisPub, redisSub } from './redisClient';

const redisAdapter = createAdapter({
    pubClient: redisPub,
    subClient: redisSub,
});

export default redisAdapter;
