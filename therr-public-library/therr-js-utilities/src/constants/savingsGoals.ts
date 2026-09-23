/**
 * Money on a savings habit: what a target means, and how a typed amount becomes one.
 *
 * Isomorphic on purpose. The same string has to be turned into the same number in three
 * places that cannot share a server-side helper:
 *
 *   1. users-service, validating `savedAmount` on `POST /habits/checkins`.
 *   2. The mobile check-in form, which wants to reject "12.345" while the user is still
 *      looking at the field rather than after a round trip.
 *   3. The check-in *reminder notification*, whose quick-reply hands back whatever the
 *      user typed into a system text field — "20", "$20", "20.00", "20,00" or " 20 ".
 *      Nothing sanitizes that before it reaches us, and it is the one entry point with
 *      no form validation in front of it at all.
 *
 * Divergence between those three is the whole reason this is one module. A client that
 * accepted a value the server then rejected would lose a check-in the user believes they
 * made, which for the notification path is silent — there is no screen to show an error
 * on.
 */

/**
 * Whether a savings target is what *each member* saves or what the group saves between
 * them.
 *
 * Both readings of "we're saving $2,000 for the trip" occur in the wild — five people
 * each putting in 2k, or five people filling one 2k pot — and they complete the pact on
 * completely different days, so the scope is recorded rather than inferred. Solo habits
 * are unaffected: with one participant the two scopes compute the same number.
 */
export enum SavingsTargetScopes {
    /** `targetAmount` is each participant's own goal. The default. */
    PER_MEMBER = 'per_member',
    /** `targetAmount` is the combined total across every participant. */
    GROUP = 'group',
}

export type SavingsTargetScope = `${SavingsTargetScopes}`;

/**
 * What a goal with no recorded scope means.
 *
 * Per-member, because it is the reading that cannot mislead a solo saver (identical
 * either way) and because the alternative silently divides a group's target by its
 * member count — a member who thought they owed 2k being told they owe 400 is a worse
 * failure than the reverse.
 */
export const DEFAULT_SAVINGS_TARGET_SCOPE: SavingsTargetScope = SavingsTargetScopes.PER_MEMBER;

/**
 * Matches `numeric(12,2)` in `habits.habit_goals.targetAmount` and
 * `habits.habit_checkins.savedAmount`: ten integer digits, two fractional. Anything at
 * or above this would be rejected by Postgres with a numeric overflow, which surfaces as
 * a 500; rejecting it here makes it a 400 with something readable in it.
 */
export const MAX_SAVINGS_AMOUNT = 9999999999.99;

/** ISO 4217 when the client does not say. Display only — nothing here converts. */
export const DEFAULT_SAVINGS_CURRENCY_CODE = 'USD';

export type SavingsAmountError = 'not-a-number' | 'negative' | 'too-large' | 'too-precise';

export interface IParsedSavingsAmount {
    /** The amount in major units, rounded to 2dp. Absent when `error` is set. */
    amount?: number;
    error?: SavingsAmountError;
}

/**
 * Everything that is decoration rather than digits: currency symbols and codes, spaces
 * (including the non-breaking and narrow ones keyboards emit), and grouping separators.
 *
 * Grouping is the subtle one. "1,234" is one thousand two hundred and thirty-four in
 * en-US and one point two three four in de-DE, and a notification quick-reply carries no
 * locale with it. `normalizeDecimalSeparator` below resolves that by *shape* rather than
 * by guessing a locale.
 */
const STRIP_PATTERN = /[^\d.,-]/g;

/**
 * Decide which of `.` and `,` is the decimal point, then produce a plain `1234.56`.
 *
 * The rules, in order:
 *   - Both present: the *last* one is the decimal separator and the other is grouping.
 *     "1.234,56" and "1,234.56" both resolve correctly, and neither needs a locale.
 *   - The same separator more than once: grouping. "1,234,567" is 1234567.
 *   - A lone separator with exactly 3 digits after it AND 1–3 digits before it:
 *     grouping. That is the shape of a thousands group and nothing else, so "1,234"
 *     and "1.234" are both 1234.
 *   - Anything else: a decimal point, including when that leaves more precision than a
 *     cent. "25.5555" stays 25.5555 and is then *rejected* by the precision check.
 *
 * That last rule is the one worth being careful about. An earlier version dropped any
 * separator it had not already classified as decimal, which turned "25.5555" into
 * 255555 — a silent 1000× overstatement of someone's savings, reported back to them as
 * a success. Anything this function cannot confidently read as grouping is therefore
 * left as a decimal, where being wrong produces a visible error instead of wrong money.
 *
 * "25.555" remains genuinely ambiguous — 25555 grouped, or 25.555 over-precise — and
 * resolves to 25555, because three trailing digits is what grouping looks like and
 * money is not written to three decimals. It is the only case where a typo is absorbed
 * rather than rejected.
 */
const normalizeDecimalSeparator = (stripped: string): string => {
    const lastDot = stripped.lastIndexOf('.');
    const lastComma = stripped.lastIndexOf(',');

    if (lastDot !== -1 && lastComma !== -1) {
        const decimalAt = Math.max(lastDot, lastComma);
        const integerPart = stripped.slice(0, decimalAt).replace(/[.,]/g, '');
        return `${integerPart}.${stripped.slice(decimalAt + 1)}`;
    }

    const separatorAt = Math.max(lastDot, lastComma);
    if (separatorAt === -1) {
        return stripped;
    }

    const separator = stripped[separatorAt];
    const occurrences = stripped.split(separator).length - 1;
    const leadingDigits = separatorAt;
    const trailingDigits = stripped.length - separatorAt - 1;

    const isGrouping = occurrences > 1
        || (trailingDigits === 3 && leadingDigits >= 1 && leadingDigits <= 3);

    if (isGrouping) {
        return stripped.replace(/[.,]/g, '');
    }

    return `${stripped.slice(0, separatorAt)}.${stripped.slice(separatorAt + 1)}`;
};

/**
 * Turn user input into an amount, or say why it is not one.
 *
 * Accepts a number as well as a string so callers do not have to branch: a JSON body
 * sends `12.5`, a notification quick-reply sends `"$12.50"`, and both arrive here.
 *
 * `null`, `undefined` and the empty string are NOT errors — they mean "no amount was
 * recorded", which is the normal state of a check-in on a non-savings habit and of a
 * savings check-in someone completed without filling the field in. Callers get
 * `{ amount: undefined, error: undefined }` and should write NULL. Anything non-empty
 * that is not a valid amount *is* an error: silently dropping a number the user typed
 * would lose money from their total with no way to tell.
 */
export const parseSavingsAmount = (input: unknown): IParsedSavingsAmount => {
    if (input === null || input === undefined || input === '') {
        return {};
    }

    let value: number;

    if (typeof input === 'number') {
        value = input;
    } else if (typeof input === 'string') {
        const stripped = input.replace(STRIP_PATTERN, '');
        if (!stripped || !/\d/.test(stripped)) {
            return { error: 'not-a-number' };
        }
        value = Number(normalizeDecimalSeparator(stripped));
    } else {
        return { error: 'not-a-number' };
    }

    if (!Number.isFinite(value)) {
        return { error: 'not-a-number' };
    }
    if (value < 0) {
        return { error: 'negative' };
    }
    if (value > MAX_SAVINGS_AMOUNT) {
        return { error: 'too-large' };
    }

    // Rounded rather than truncated, and compared against the input so that a genuine
    // third decimal is reported instead of being quietly absorbed. The 1e-9 tolerance is
    // for values that are already 2dp but not exactly representable in binary floating
    // point (8.13 * 100 is 812.9999999999999), which would otherwise all read as
    // over-precise.
    const rounded = Math.round(value * 100) / 100;
    if (Math.abs(value - rounded) > 1e-9) {
        return { error: 'too-precise' };
    }

    return { amount: rounded };
};

/**
 * Add amounts without accumulating binary floating-point error.
 *
 * A pact's total is a Postgres `SUM(numeric)` and is exact; this is for the places that
 * add in JS — combining per-member totals into a group total, or adding the check-in
 * just written to a total read a moment earlier. Summing 0.1 ten times in plain JS gives
 * 0.9999999999999999, which renders as "$1.00" but compares as *less than* a 1.00
 * target, so a goal that has been reached reads as not reached. Cents are integers.
 */
export const sumSavingsAmounts = (amounts: (number | string | null | undefined)[]): number => {
    // Explicit generic: without it TypeScript picks the array's own element type for
    // the accumulator (the `reduce(cb, initialValue: T)` overload), which here is
    // `number | string | null | undefined` and makes the arithmetic below an error.
    const cents = amounts.reduce<number>((total, amount) => {
        const value = typeof amount === 'string' ? Number(amount) : amount;
        if (value === null || value === undefined || !Number.isFinite(value)) {
            return total;
        }
        return total + Math.round(value * 100);
    }, 0);

    return cents / 100;
};

/**
 * Whether a total has reached a target.
 *
 * Both sides are taken to cents before comparing, for the reason above: `0.1 + 0.2 >= 0.3`
 * is false in JS, and a saver who has met their goal to the penny must not be told they
 * have not. A null/absent or non-positive target is never "reached" — an open-ended
 * savings habit has no finish line and its pact ends on its duration like any other.
 */
export const hasReachedSavingsTarget = (
    total: number | string | null | undefined,
    target: number | string | null | undefined,
): boolean => {
    const targetValue = typeof target === 'string' ? Number(target) : target;
    if (targetValue === null || targetValue === undefined || !Number.isFinite(targetValue) || targetValue <= 0) {
        return false;
    }

    const totalValue = typeof total === 'string' ? Number(total) : total;
    if (totalValue === null || totalValue === undefined || !Number.isFinite(totalValue)) {
        return false;
    }

    return Math.round(totalValue * 100) >= Math.round(targetValue * 100);
};
