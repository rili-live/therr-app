/**
 * Unit tests for one-time code generation and the per-destination-number SMS budget.
 *
 * Both exist to blunt specific attacks on the passwordless phone routes, and both fail
 * silently if they regress — a predictable code still looks like a code, and a missing budget
 * still sends. These assertions are the only thing that would notice.
 */
import { expect } from 'chai';
import {
    AUTH_SMS_MAX_SENDS_PER_NUMBER,
    AUTH_SMS_SEND_WINDOW_SECONDS,
    chargeSmsSendBudget,
    generateVerificationCode,
} from '../../../../src/services/phone/verificationCodes';

/** In-memory stand-in for the counter half of the Redis client. */
const fakeStore = () => {
    const counters: Record<string, number> = {};
    const expiries: Record<string, number> = {};

    return {
        counters,
        expiries,
        incr: (key: string) => {
            counters[key] = (counters[key] || 0) + 1;
            return Promise.resolve(counters[key]);
        },
        expire: (key: string, seconds: number) => {
            expiries[key] = seconds;
            return Promise.resolve(1);
        },
    };
};

describe('generateVerificationCode', () => {
    it('always produces a 6-digit code', () => {
        for (let i = 0; i < 2000; i += 1) {
            const code = generateVerificationCode();

            expect(code).to.be.at.least(100000);
            expect(code).to.be.at.most(999999);
            expect(`${code}`).to.have.lengthOf(6);
        }
    });

    it('does not draw from a predictable sequence', () => {
        // A weak generator is not provable by sampling, but a *broken* one — a constant, a
        // counter, a stub left behind — is. This catches that class outright.
        const codes = new Set<number>();
        for (let i = 0; i < 1000; i += 1) {
            codes.add(generateVerificationCode());
        }

        // 1000 draws from 900k values collide rarely; anything under 900 distinct means the
        // source is not behaving like a uniform random draw.
        expect(codes.size).to.be.greaterThan(900);
    });

    it('is not affected by seeding Math.random', () => {
        // Guards the actual regression: reverting to Math.random would make codes derivable
        // from the engine's PRNG state.
        const original = Math.random;
        try {
            Math.random = () => 0.5;
            const codes = new Set<number>();
            for (let i = 0; i < 50; i += 1) {
                codes.add(generateVerificationCode());
            }

            expect(codes.size).to.be.greaterThan(1);
        } finally {
            Math.random = original;
        }
    });
});

describe('chargeSmsSendBudget', () => {
    it('allows exactly the allowance and then refuses', async () => {
        const store = fakeStore();
        const results: boolean[] = [];

        for (let i = 0; i < AUTH_SMS_MAX_SENDS_PER_NUMBER + 2; i += 1) {
            results.push(await chargeSmsSendBudget(store, 'phone-login-sends:+13175551234')); // eslint-disable-line no-await-in-loop
        }

        expect(results.slice(0, AUTH_SMS_MAX_SENDS_PER_NUMBER)).to.deep.equal(
            new Array(AUTH_SMS_MAX_SENDS_PER_NUMBER).fill(true),
        );
        expect(results.slice(AUTH_SMS_MAX_SENDS_PER_NUMBER)).to.deep.equal([false, false]);
    });

    it('sets the window TTL once, on the first send only', async () => {
        const store = fakeStore();
        const key = 'phone-login-sends:+13175551234';

        await chargeSmsSendBudget(store, key);
        expect(store.expiries[key]).to.equal(AUTH_SMS_SEND_WINDOW_SECONDS);

        // Re-arming the TTL on every send would let a steady trickle hold the window open
        // forever, so the key must not be touched again.
        delete store.expiries[key];
        await chargeSmsSendBudget(store, key);
        expect(store.expiries[key]).to.equal(undefined);
    });

    it('keeps counting once over budget, so pumping does not let the window lapse', async () => {
        const store = fakeStore();
        const key = 'phone-login-sends:+13175551234';

        for (let i = 0; i < AUTH_SMS_MAX_SENDS_PER_NUMBER + 3; i += 1) {
            await chargeSmsSendBudget(store, key); // eslint-disable-line no-await-in-loop
        }

        expect(store.counters[key]).to.equal(AUTH_SMS_MAX_SENDS_PER_NUMBER + 3);
    });

    it('budgets each phone number independently', async () => {
        const store = fakeStore();

        for (let i = 0; i < AUTH_SMS_MAX_SENDS_PER_NUMBER; i += 1) {
            await chargeSmsSendBudget(store, 'phone-login-sends:+13175551234'); // eslint-disable-line no-await-in-loop
        }

        expect(await chargeSmsSendBudget(store, 'phone-login-sends:+13175551234')).to.equal(false);
        expect(await chargeSmsSendBudget(store, 'phone-login-sends:+13175559999')).to.equal(true);
    });

    it('budgets sign-in and sign-up separately for the same number', async () => {
        const store = fakeStore();

        for (let i = 0; i < AUTH_SMS_MAX_SENDS_PER_NUMBER; i += 1) {
            await chargeSmsSendBudget(store, 'phone-login-sends:+13175551234'); // eslint-disable-line no-await-in-loop
        }

        expect(await chargeSmsSendBudget(store, 'phone-login-sends:+13175551234')).to.equal(false);
        expect(await chargeSmsSendBudget(store, 'phone-register-sends:+13175551234')).to.equal(true);
    });
});
