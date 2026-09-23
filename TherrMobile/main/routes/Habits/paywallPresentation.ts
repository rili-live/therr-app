import { resolvePurchaseValue } from '../../utilities/habitsBilling';

/**
 * Presentation math for `UpgradePaywall`, kept apart from the screen so it can
 * be unit-tested without the native module graph (same reason as `pactState`).
 */

/**
 * How many months of the monthly plan the founder unlock costs — the number
 * that makes "pay once" concrete. Null whenever it cannot be stated honestly:
 * either price unknown, prices in different currencies (a rate we do not have),
 * or a ratio under one month, where "pays for itself in 0 months" reads as a
 * mistake rather than a deal.
 *
 * Rounded up: "less than 3 months" is true of a 2.86 ratio; "2 months" is not.
 */
export const getFounderValueAnchorMonths = (
    founderProduct: any,
    premiumProduct: any,
): number | null => {
    const founder = resolvePurchaseValue(founderProduct);
    const monthly = resolvePurchaseValue(premiumProduct);

    if (!founder || !monthly || founder.currency !== monthly.currency) {
        return null;
    }

    if (!(monthly.value > 0) || !(founder.value > 0)) {
        return null;
    }

    const months = Math.ceil(founder.value / monthly.value);

    return months >= 1 ? months : null;
};

/**
 * Share of founder seats already claimed, for the seat meter's fill width.
 *
 * Clamped to [0, 1] because both numbers arrive over the wire, and a bar that
 * overflows its track (a `claimed` above `total`) or renders a negative width
 * is a layout glitch on the one screen that asks for money. A claimed seat is
 * always visible: below a few percent the fill would round away to nothing and
 * the meter would say "nobody has bought this", which is not what the number
 * says.
 */
const MIN_VISIBLE_FILL = 0.03;

export const getSeatFillRatio = (offer: { claimed?: number; total?: number } | null | undefined): number => {
    const claimed = Number(offer?.claimed);
    const total = Number(offer?.total);

    if (!Number.isFinite(claimed) || !Number.isFinite(total) || total <= 0 || claimed <= 0) {
        return 0;
    }

    return Math.min(1, Math.max(MIN_VISIBLE_FILL, claimed / total));
};

/**
 * "4,982" rather than "4982": a seat count is the one number on the screen
 * meant to be read at a glance, and the thousands separator is what makes a
 * four-digit figure legible. Falls back to the bare digits where `Intl` is
 * unavailable (an old Hermes without the locale data) rather than throwing.
 */
export const formatSeatCount = (value: number | undefined | null, locale: string): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '';
    }

    try {
        return value.toLocaleString(locale);
    } catch {
        return `${value}`;
    }
};
