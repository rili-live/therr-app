import { expect } from 'chai';
import RateLimit from 'express-rate-limit';
import { createRateLimiterRedisStore } from '../../../src/store/redisClient';

/**
 * Regression: every gateway limiter once shared one RedisStore. The store keeps a single `windowMs`
 * that each limiter's `init()` overwrites, and it expires every key on that value — so the SMS
 * routes' "3 per 15 minutes" was really "3 per ~10 seconds" (the last-registered service limiter),
 * and a few IPs sent thousands of verification texts on 2026-10-20/21.
 */
describe('createRateLimiterRedisStore', () => {
    it('keeps each limiter on its own window', () => {
        const fifteenMinuteStore = createRateLimiterRedisStore('test:3/15m');
        const tenSecondStore = createRateLimiterRedisStore('test:service');

        // express-rate-limit calls `store.init({ windowMs, ... })` at construction.
        RateLimit({ store: fifteenMinuteStore, windowMs: 15 * 60 * 1000, max: 3 });
        RateLimit({ store: tenSecondStore, windowMs: 10 * 1000, max: 200 });

        expect(fifteenMinuteStore).to.not.equal(tenSecondStore);
        expect((fifteenMinuteStore as any).windowMs).to.equal(15 * 60 * 1000);
        expect((tenSecondStore as any).windowMs).to.equal(10 * 1000);
    });

    it('namespaces keys by limiter, so two IP-keyed limiters do not share a counter', () => {
        const a = createRateLimiterRedisStore('test:a');
        const b = createRateLimiterRedisStore('test:b');

        expect(a.prefixKey('1.2.3.4')).to.not.equal(b.prefixKey('1.2.3.4'));
        expect(a.prefixKey('1.2.3.4')).to.equal('api-gateway:rl:test:a:1.2.3.4');
    });
});
