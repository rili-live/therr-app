import { createAdapter } from '@socket.io/redis-adapter';
import { redisPub, redisSub } from './redisClient';

const redisAdapter = createAdapter(redisPub, redisSub);

export default redisAdapter;
