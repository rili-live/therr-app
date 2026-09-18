import { IHabitsLifetimeOffer } from 'therr-react/types';

/**
 * Whether the drawer should offer the founder unlock.
 *
 * The CTA is the only place in the app a user can reach the offer without first
 * hitting a wall — everything else routes here from a 402 at the free-tier cap,
 * which means the people most likely to buy (the ones enjoying the app enough to
 * keep going) only ever see it at the moment they are being told "no". This is
 * the other door.
 *
 * It renders on exactly four conditions, and every one of them is a way the
 * button could otherwise lie to the user:
 *
 *   1. **The offer has loaded.** Absent state is not "available", it is "we do
 *      not know yet" — and it is also what an offline drawer open looks like,
 *      because the axios offline interceptor resolves failed GETs with empty
 *      data and `getLifetimeOffer` dispatches nothing for that case. Failing
 *      closed costs a user one drawer open; failing open advertises a purchase
 *      that cannot complete.
 *   2. **The account is not already entitled.** `isEntitled` is deliberately
 *      broader than "has a founder purchase" — it also covers admins and premium
 *      subscribers, who should not be sold something they already have.
 *   3. **Seats remain.** The founder offer is a fixed 5,000
 *      (`HABITS_LIFETIME_FOUNDER_LIMIT`). The server still honours a purchase
 *      that lands past the limit — refusing to record a completed Play
 *      transaction would leave someone charged and unentitled — but it allocates
 *      no founder number, so continuing to advertise a sold-out offer sells
 *      something we cannot deliver.
 *   4. **Play credentials are configured.** With none set, `GET /habits/lifetime`
 *      reports `isStoreConfigured: false` and `UpgradePaywall` hides its own
 *      purchase button. A drawer entry into a screen with nothing to tap is
 *      worse than no drawer entry, so this mirrors the paywall's own gate rather
 *      than second-guessing it.
 *
 * `isSoldOut` and `remaining` are checked independently even though the server
 * derives the first from the second. They arrive over the wire and a client that
 * trusts only one of them would advertise a sold-out offer if the two ever
 * disagree; requiring both to say "available" is the conservative read.
 *
 * Kept free of react-native imports so it stays unit-testable without the native
 * module graph the drawer pulls in — same reason as `habitsBadgeState`.
 */
export const shouldShowFounderCta = (
    lifetimeOffer: IHabitsLifetimeOffer | null | undefined,
): boolean => {
    if (!lifetimeOffer) {
        return false;
    }

    if (lifetimeOffer.isEntitled) {
        return false;
    }

    if (!lifetimeOffer.isStoreConfigured) {
        return false;
    }

    if (lifetimeOffer.isSoldOut) {
        return false;
    }

    // A malformed or missing count is treated as sold out rather than as
    // unlimited, for the same reason the whole helper fails closed.
    const { remaining } = lifetimeOffer;

    return typeof remaining === 'number' && Number.isFinite(remaining) && remaining > 0;
};

export default shouldShowFounderCta;
