import { HabitAmountUnit, isHabitAmountUnit } from 'therr-js-utilities/constants';

/**
 * Rendering the amounts on a measured habit ("95 min", "12.5 km"). Parsing lives in
 * `parseSavingsAmount`, which the server shares, exactly as it does for money.
 */

type Translate = (key: string, params?: any) => string;

/** The unit's full name for a picker ("Minutes"), or '' for an unknown unit. */
export const getHabitAmountUnitLabel = (unit: string | null | undefined, translate: Translate): string => (
    isHabitAmountUnit(unit) ? translate(`pages.habits.amounts.units.${unit}.label`) : ''
);

/** The unit's short form for beside a number ("min"), or '' for an unknown unit. */
export const getHabitAmountUnitShort = (unit: string | null | undefined, translate: Translate): string => (
    isHabitAmountUnit(unit) ? translate(`pages.habits.amounts.units.${unit}.short`) : ''
);

/**
 * Format an amount with its unit. Whole numbers print without decimals, and a fraction
 * keeps at most two, matching what the parser accepts. `Intl.NumberFormat` supplies the
 * locale's decimal separator and grouping; it is wrapped because a bad locale tag throws.
 */
export const formatHabitAmount = (
    amount: number | null | undefined,
    unit: HabitAmountUnit | string | null | undefined,
    translate: Translate,
    locale?: string,
): string => {
    const value = Number(amount);
    const safeValue = Number.isFinite(value) ? value : 0;
    let number: string;

    try {
        number = new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: 2 }).format(safeValue);
    } catch {
        number = String(Math.round(safeValue * 100) / 100);
    }

    const short = getHabitAmountUnitShort(unit, translate);
    return short ? `${number} ${short}` : number;
};
