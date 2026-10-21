import { isIPv6 } from 'net';
import { chargeSmsSendBudget, ISmsBudgetStore } from './verificationCodes';

/**
 * Automatic flagging of clients that pump verification texts.
 *
 * The signature of SMS pumping is texts that are never used: on 2026-10-20/21 `register/start`
 * sent 3,861 codes and `register/verify` was called twice. A real user requests a code and then
 * enters it. So every send is counted against the requesting client, a successful verification
 * from that client clears the count, and a client that runs up `SMS_SENDER_FLAG_THRESHOLD`
 * unverified sends inside a day is flagged for `SMS_SENDER_BLOCK_SECONDS`.
 *
 * A flagged client is shadow-banned rather than refused: the routes answer exactly as if the text
 * went out, and nothing is sent. A bot told "429" rotates to a fresh IP; a bot told "sent" keeps
 * spending its requests on an address that costs us nothing.
 *
 * Split out of `router.ts` (like `./verificationCodes`) so it can be unit tested without standing
 * up the router's Twilio and Redis clients.
 */

export const SMS_SENDER_FLAG_THRESHOLD = 10;
export const SMS_SENDER_WINDOW_SECONDS = 24 * 60 * 60;
export const SMS_SENDER_BLOCK_SECONDS = 3 * 24 * 60 * 60;

const unverifiedSendsKey = (senderKey: string) => `sms-unverified-sends:${senderKey}`;
export const blockedSenderKey = (senderKey: string) => `sms-blocked-sender:${senderKey}`;

/** The slice of the Redis client this module needs. */
export interface ISmsSenderFlagStore extends ISmsBudgetStore {
    exists: (key: string) => Promise<number>;
    set: (key: string, value: string, mode: 'EX', seconds: number) => Promise<any>;
    del: (key: string) => Promise<number>;
}

const expandIPv6 = (ip: string): string[] => {
    const [head, tail] = ip.split('::');
    const toGroups = (part?: string) => (part ? part.split(':') : [])
        // An embedded IPv4 tail (`::ffff:1.2.3.4`, `64:ff9b::1.2.3.4`) fills the last two groups.
        .flatMap((group) => (group.includes('.') ? ['0', '0'] : [group]));
    const headGroups = toGroups(head);
    const tailGroups = toGroups(tail);
    const fill = tail === undefined ? [] : new Array(8 - headGroups.length - tailGroups.length).fill('0');

    return [...headGroups, ...fill, ...tailGroups];
};

/**
 * The identity a client is counted and limited under. IPv4 addresses stand alone. IPv6 addresses
 * are grouped by /64: a single subscriber is handed a whole /64, so keying on the full address let
 * the 2026-10 attack (two Pakistani /48s) mint a fresh "client" per request. IPv4-mapped IPv6
 * (`::ffff:1.2.3.4`) is treated as the IPv4 address it is.
 */
export const getSmsSenderKey = (ip?: string): string => {
    const raw = `${ip || ''}`.trim();
    const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);

    if (mapped) {
        return mapped[1];
    }

    if (!isIPv6(raw)) {
        return raw;
    }

    const prefix = expandIPv6(raw)
        .slice(0, 4)
        .map((group) => Number.parseInt(group || '0', 16).toString(16))
        .join(':');

    return `${prefix}::/64`;
};

/** True when this client has been flagged (automatically, or by hand — see the PR notes). */
export const isSmsSenderFlagged = async (store: ISmsSenderFlagStore, senderKey: string): Promise<boolean> => {
    if (!senderKey) {
        return false;
    }

    return (await store.exists(blockedSenderKey(senderKey))) > 0;
};

/**
 * Counts one not-yet-verified send against the client and flags it once it has run up more than
 * `SMS_SENDER_FLAG_THRESHOLD` in the window. Resolves `true` when the client is (now) flagged, in
 * which case the caller must not send.
 */
export const recordUnverifiedSmsSend = async (store: ISmsSenderFlagStore, senderKey: string): Promise<boolean> => {
    if (!senderKey) {
        return false;
    }

    const withinAllowance = await chargeSmsSendBudget(
        store,
        unverifiedSendsKey(senderKey),
        SMS_SENDER_FLAG_THRESHOLD,
        SMS_SENDER_WINDOW_SECONDS,
    );

    if (withinAllowance) {
        return false;
    }

    await store.set(blockedSenderKey(senderKey), 'auto', 'EX', SMS_SENDER_BLOCK_SECONDS);

    return true;
};

/** A successful verification proves a real handset is behind this client: forget its sends. */
export const clearUnverifiedSmsSends = async (store: ISmsSenderFlagStore, senderKey: string): Promise<void> => {
    if (senderKey) {
        await store.del(unverifiedSendsKey(senderKey));
    }
};
