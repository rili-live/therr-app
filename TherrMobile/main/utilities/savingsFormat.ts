import { DEFAULT_SAVINGS_CURRENCY_CODE } from 'therr-js-utilities/constants';

/**
 * Rendering money in the Habits screens.
 *
 * Formatting only — parsing and validation live in `parseSavingsAmount` in
 * therr-js-utilities, which the server shares, so a value this app accepts is exactly a
 * value the server accepts.
 */

/**
 * Format an amount for display, e.g. `$1,250.00`.
 *
 * `Intl.NumberFormat` is available in Hermes with the full ICU build React Native ships,
 * and it is what gets a European user a comma decimal without us maintaining a table.
 * It is wrapped anyway: a currency code the runtime does not recognise throws a
 * RangeError, and a savings total is not worth crashing a screen over. The fallback
 * prints the code alongside the number so the value is never ambiguous.
 */
export const formatSavingsAmount = (
    amount: number | null | undefined,
    currencyCode?: string | null,
    locale?: string,
): string => {
    const value = Number(amount);
    const safeValue = Number.isFinite(value) ? value : 0;
    const code = (currencyCode || DEFAULT_SAVINGS_CURRENCY_CODE).toUpperCase();

    try {
        return new Intl.NumberFormat(locale || undefined, {
            style: 'currency',
            currency: code,
            // Whole amounts are the common case for a savings goal and "$1,250" reads
            // better than "$1,250.00"; cents still show when they are there.
            minimumFractionDigits: safeValue % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2,
        }).format(safeValue);
    } catch {
        return `${code} ${safeValue.toFixed(safeValue % 1 === 0 ? 0 : 2)}`;
    }
};

/**
 * Progress toward a target as a 0–1 fraction, for a progress bar's width.
 *
 * Clamped at 1 so an overshoot cannot render a bar wider than its track — the overshoot
 * is worth celebrating in the copy, not in the layout. Returns null when there is no
 * usable target, which is the signal to render a running total with no bar at all: an
 * open-ended savings habit has no finish line, and a bar implies one.
 */
export const getSavingsProgressFraction = (
    totalSaved: number | null | undefined,
    targetAmount: number | null | undefined,
): number | null => {
    const target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
        return null;
    }

    const total = Number(totalSaved);
    if (!Number.isFinite(total) || total <= 0) {
        return 0;
    }

    return Math.min(1, total / target);
};
