import crypto from 'crypto';

/**
 * One-time code generation and the per-destination-number send budget for the passwordless
 * phone flows.
 *
 * Split out of `router.ts` so both can be exercised directly — the router imports the Twilio
 * and Redis clients at module load, which a unit test has no business standing up. The budget
 * takes its Redis client as an argument for the same reason.
 */

/**
 * A 6-digit one-time code, drawn from a cryptographically secure source.
 *
 * `crypto.randomInt` rather than `Math.random`: on the passwordless routes this code is *the*
 * credential for full account access. V8 implements `Math.random` with xorshift128+, whose
 * internal state is recoverable from a handful of observed outputs — an attacker who can
 * request codes for numbers they control could then predict the code issued to someone else,
 * without ever guessing. The upper bound is exclusive, so this yields 100000..999999.
 */
export const generateVerificationCode = (): number => crypto.randomInt(100000, 1000000);

// Sends are budgeted per *destination number*, not just per caller IP. The IP limiters in
// ./limitation/phone.ts are trivially bypassed by rotating source addresses, and without a
// per-number cap that buys an attacker two things: a real Twilio bill, and a denial of
// sign-in against a chosen victim — every `start` call overwrites that number's cached code,
// so a steady trickle of them means the code in the user's hand is never the one on file.
// Five per hour comfortably covers a legitimate user who mistypes and re-sends a few times.
export const AUTH_SMS_MAX_SENDS_PER_NUMBER = 5;
export const AUTH_SMS_SEND_WINDOW_SECONDS = 60 * 60;

/** The slice of the Redis client this module needs. */
export interface ISmsBudgetStore {
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number, mode: 'NX') => Promise<any>;
}

/**
 * Charges one SMS against a phone number's hourly budget, resolving `false` when the number
 * has already had its allowance (in which case the caller must not send).
 *
 * Over-budget attempts are still counted, so sustained pumping keeps the window pinned rather
 * than letting it lapse. This is a fixed window starting at the first send — deliberately
 * simpler than a sliding window, since the cost of an extra allowed send at a window boundary
 * is one SMS.
 *
 * `EXPIRE .. NX` (set a TTL only where none exists) rather than "set it when the counter reads
 * 1". The counter-based version leaves a window: if the process dies between the INCR and the
 * EXPIRE, the key survives with no TTL and never expires — and because a spent budget makes
 * `/auth/start` go quiet rather than error, that number would be permanently, silently unable
 * to receive a sign-in code. NX is idempotent, so a later call repairs the missing TTL while
 * still refusing to re-arm a live one.
 */
export const chargeSmsSendBudget = async (
    store: ISmsBudgetStore,
    key: string,
    maxSends = AUTH_SMS_MAX_SENDS_PER_NUMBER,
    windowSeconds = AUTH_SMS_SEND_WINDOW_SECONDS,
): Promise<boolean> => {
    const sends = await store.incr(key);

    await store.expire(key, windowSeconds, 'NX');

    return sends <= maxSends;
};

/**
 * A ceiling on verification texts across the whole gateway, whatever the number or caller.
 *
 * The per-IP and per-number limits bound one attacker; they don't bound a botnet. The pumping run
 * on 2026-10-20/21 came from 151 IPs, so even correctly enforced per-IP limits would still have
 * allowed well over a thousand texts an hour. Real traffic is a handful of codes a day, so a cap
 * far above that costs real users nothing and turns an unbounded bill into a bounded one. Read at
 * call time so `TWILIO_SMS_GLOBAL_HOURLY_CAP` can be raised without a rebuild.
 */
export const DEFAULT_SMS_GLOBAL_HOURLY_CAP = 60;
export const SMS_GLOBAL_BUDGET_KEY = 'sms-global-sends';

export const getSmsGlobalHourlyCap = (rawCap = process.env.TWILIO_SMS_GLOBAL_HOURLY_CAP): number => {
    const cap = Number.parseInt(`${rawCap || ''}`, 10);

    return Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_SMS_GLOBAL_HOURLY_CAP;
};

/** Error message a send rejects with once the global hourly budget is spent. */
export const SMS_GLOBAL_BUDGET_EXHAUSTED = 'Global SMS budget exhausted for this hour';

/** Charges one SMS against the gateway-wide hourly budget, resolving `false` once it is spent. */
export const chargeGlobalSmsBudget = (store: ISmsBudgetStore): Promise<boolean> => chargeSmsSendBudget(
    store,
    SMS_GLOBAL_BUDGET_KEY,
    getSmsGlobalHourlyCap(),
    60 * 60,
);
