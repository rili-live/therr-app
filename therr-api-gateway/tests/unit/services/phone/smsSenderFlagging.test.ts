/**
 * Unit tests for automatic flagging of clients that pump verification texts.
 */
import { expect } from 'chai';
import {
    blockedSenderKey,
    clearUnverifiedSmsSends,
    getSmsSenderKey,
    isSmsSenderFlagged,
    recordUnverifiedSmsSend,
    SMS_SENDER_BLOCK_SECONDS,
    SMS_SENDER_FLAG_THRESHOLD,
} from '../../../../src/services/phone/smsSenderFlagging';

/** In-memory stand-in for the slice of the Redis client the module uses. */
const fakeStore = () => {
    const values: Record<string, any> = {};
    const expiries: Record<string, number> = {};

    return {
        values,
        expiries,
        incr: (key: string) => {
            values[key] = (values[key] || 0) + 1;
            return Promise.resolve(values[key]);
        },
        expire: (key: string, seconds: number, mode: 'NX') => {
            if (mode === 'NX' && expiries[key] !== undefined) {
                return Promise.resolve(0);
            }
            expiries[key] = seconds;
            return Promise.resolve(1);
        },
        exists: (key: string) => Promise.resolve(values[key] !== undefined ? 1 : 0),
        set: (key: string, value: string, _mode: 'EX', seconds: number) => {
            values[key] = value;
            expiries[key] = seconds;
            return Promise.resolve('OK');
        },
        del: (key: string) => {
            const existed = values[key] !== undefined ? 1 : 0;
            delete values[key];
            delete expiries[key];
            return Promise.resolve(existed);
        },
    };
};

describe('getSmsSenderKey', () => {
    it('keeps IPv4 addresses as they are', () => {
        expect(getSmsSenderKey('102.11.90.28')).to.equal('102.11.90.28');
    });

    it('unwraps IPv4-mapped IPv6', () => {
        expect(getSmsSenderKey('::ffff:102.11.90.28')).to.equal('102.11.90.28');
    });

    it('groups IPv6 addresses by /64, so rotating within a subscriber prefix is one client', () => {
        // Both addresses the 2026-10 attack used from one Pakistani /64.
        const a = getSmsSenderKey('2401:ba80:a352:cf4b:8ef:4aff:fea9:e200');
        const b = getSmsSenderKey('2401:ba80:a352:cf4b:4f5:34d9:159d:cb78');

        expect(a).to.equal('2401:ba80:a352:cf4b::/64');
        expect(b).to.equal(a);
        expect(getSmsSenderKey('2401:ba80:a390:9d64:fe81:61d4:2a1a:15a3')).to.not.equal(a);
    });

    it('expands compressed IPv6 before taking the prefix', () => {
        expect(getSmsSenderKey('2001:db8::1')).to.equal('2001:db8:0:0::/64');
        expect(getSmsSenderKey('2001:0db8:0000:0001::abcd')).to.equal('2001:db8:0:1::/64');
    });

    it('returns an empty key for a missing address', () => {
        expect(getSmsSenderKey(undefined)).to.equal('');
    });
});

describe('SMS sender flagging', () => {
    it('allows up to the threshold of unverified sends, then flags the client', async () => {
        const store = fakeStore();

        for (let i = 0; i < SMS_SENDER_FLAG_THRESHOLD; i += 1) {
            expect(await recordUnverifiedSmsSend(store, '1.2.3.4')).to.equal(false); // eslint-disable-line no-await-in-loop
        }

        expect(await isSmsSenderFlagged(store, '1.2.3.4')).to.equal(false);
        expect(await recordUnverifiedSmsSend(store, '1.2.3.4')).to.equal(true);
        expect(await isSmsSenderFlagged(store, '1.2.3.4')).to.equal(true);
        expect(store.expiries[blockedSenderKey('1.2.3.4')]).to.equal(SMS_SENDER_BLOCK_SECONDS);
    });

    it('forgets a client\'s sends once it verifies a code', async () => {
        const store = fakeStore();

        for (let i = 0; i < SMS_SENDER_FLAG_THRESHOLD; i += 1) {
            await recordUnverifiedSmsSend(store, '1.2.3.4'); // eslint-disable-line no-await-in-loop
        }
        await clearUnverifiedSmsSends(store, '1.2.3.4');

        expect(await recordUnverifiedSmsSend(store, '1.2.3.4')).to.equal(false);
    });

    it('counts clients separately', async () => {
        const store = fakeStore();

        for (let i = 0; i <= SMS_SENDER_FLAG_THRESHOLD; i += 1) {
            await recordUnverifiedSmsSend(store, '1.2.3.4'); // eslint-disable-line no-await-in-loop
        }

        expect(await isSmsSenderFlagged(store, '5.6.7.8')).to.equal(false);
    });

    it('never flags or counts an unidentifiable client', async () => {
        const store = fakeStore();

        expect(await recordUnverifiedSmsSend(store, '')).to.equal(false);
        expect(await isSmsSenderFlagged(store, '')).to.equal(false);
        expect(Object.keys(store.values)).to.deep.equal([]);
    });
});
