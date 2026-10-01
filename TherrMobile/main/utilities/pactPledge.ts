import {
    IHabitPledge,
    MAX_PLEDGE_AMOUNT,
    MIN_PLEDGE_AMOUNT,
    getPledgeCharity,
} from 'therr-js-utilities/constants';
import { IPact, IPactMember } from 'therr-react/types';
import { formatSavingsAmount } from './savingsFormat';

/**
 * Charity pledges on a pact (WORK_IN_PROGRESS § 2.8, Phase A). No money moves through the app:
 * a missed week reminds the member of their pledge and links out to the charity.
 *
 * The server owns every rule here — `PUT /habits/pacts/:id/pledge` in users-service refuses what
 * these helpers hide. They exist so the screen never offers a button the server will refuse.
 */

/**
 * The amounts offered, in whole USD. Presets rather than a free field: a pledge is a promise to
 * oneself and one tap keeps it one. $5 is the floor stickK settled on for the same reason — a
 * smaller stake stops reading as a stake.
 */
export const PLEDGE_AMOUNT_PRESETS = [5, 10, 20, 50]
    .filter((amount) => amount >= MIN_PLEDGE_AMOUNT && amount <= MAX_PLEDGE_AMOUNT);

/** Mirrors `PLEDGEABLE_PACT_STATUSES` in users-service `handlers/pacts.ts`. */
const PLEDGEABLE_PACT_STATUSES = ['pending', 'active'];

/**
 * Whether this member may set, edit or remove a pledge on this pact right now: an `active`
 * member (a pending invitee has not joined) of a pact still in play. A pact past its end date is
 * excluded even while it still reads `active` — it has no week left to judge.
 */
export const canEditPactPledge = (
    pact: IPact | undefined,
    member: IPactMember | undefined,
    hasEnded: boolean,
): boolean => !!pact
    && !!member
    && member.status === 'active'
    && PLEDGEABLE_PACT_STATUSES.includes(pact.status)
    && !hasEnded;

/**
 * A new pledge needs someone to see it. Phase A is pact-only, and a pact the member is keeping
 * alone is a solo habit in all but name. An existing pledge stays removable either way.
 */
export const canAddPactPledge = (pact: IPact | undefined): boolean => !!pact && !pact.isSolo;

/** The pledge as stored, or null when absent, malformed, or naming a charity this build lacks. */
export const getValidPledge = (member: IPactMember | undefined): IHabitPledge | null => {
    const pledge = member?.pledge;
    if (!pledge || !Number.isFinite(Number(pledge.amount)) || !getPledgeCharity(pledge.charityKey)) {
        return null;
    }
    return pledge;
};

/**
 * Local midnight on the Monday that starts the week containing `now`.
 *
 * The server judges each member's week in their own zone, and the device zone is the best
 * proxy the client has for that.
 */
export const getStartOfLocalWeek = (now: Date): Date => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    return start;
};

/**
 * Whether the pledge first applies next week rather than this one.
 *
 * A week is judged only if the pledge was in force from its Monday (`utilities/pledgeVerdict.ts`),
 * so a pledge made on a Wednesday leaves that week unjudged. Editing keeps `pledgedAt`, so an
 * edited pledge that was already in force stays in force.
 */
export const isPledgeStartingNextWeek = (pledge: IHabitPledge, now: Date = new Date()): boolean => {
    const pledgedAt = new Date(pledge.pledgedAt);
    if (Number.isNaN(pledgedAt.getTime())) {
        return false;
    }
    return pledgedAt.getTime() > getStartOfLocalWeek(now).getTime();
};

/** Every curated recipient is a US organisation, so Phase A pledges carry no currency: always USD. */
export const formatPledgeAmount = (amount: number, locale?: string): string => formatSavingsAmount(amount, 'USD', locale);
