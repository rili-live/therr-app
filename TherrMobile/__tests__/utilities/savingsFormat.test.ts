// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import { formatSavingsAmount, getSavingsProgressFraction } from '../../main/utilities/savingsFormat';

/**
 * Display-side money helpers. Parsing lives in `parseSavingsAmount` (therr-js-utilities,
 * shared with the server); these only decide how a value is shown.
 */

describe('formatSavingsAmount', () => {
    it('renders a whole amount without trailing zeroes and a fractional one with cents', () => {
        // "$1,250" reads better than "$1,250.00" for a savings goal, but cents must not
        // disappear when they are real money.
        expect(formatSavingsAmount(1250, 'USD', 'en-US')).toBe('$1,250');
        expect(formatSavingsAmount(1250.5, 'USD', 'en-US')).toBe('$1,250.50');
    });

    it('treats a missing amount as zero rather than rendering NaN', () => {
        expect(formatSavingsAmount(null, 'USD', 'en-US')).toBe('$0');
        expect(formatSavingsAmount(undefined, 'USD', 'en-US')).toBe('$0');
    });

    it('falls back to a readable string for a currency the runtime rejects', () => {
        // An unknown code makes Intl throw a RangeError. A savings total is not worth
        // crashing a screen over, and the fallback still names the currency so the
        // number is never ambiguous.
        expect(formatSavingsAmount(25, 'NOTACODE', 'en-US')).toBe('NOTACODE 25');
    });

    it('defaults the currency rather than rendering a bare number', () => {
        expect(formatSavingsAmount(25, null, 'en-US')).toBe('$25');
    });
});

describe('getSavingsProgressFraction', () => {
    it('returns null with no usable target, which is the no-progress-bar signal', () => {
        // An open-ended savings habit has no finish line, and a bar implies one.
        expect(getSavingsProgressFraction(500, null)).toBe(null);
        expect(getSavingsProgressFraction(500, 0)).toBe(null);
        expect(getSavingsProgressFraction(500, undefined)).toBe(null);
    });

    it('clamps an overshoot to a full bar', () => {
        // Overshooting is worth celebrating in the copy, not by drawing a bar wider
        // than its own track.
        expect(getSavingsProgressFraction(1500, 1000)).toBe(1);
    });

    it('reports the fraction in between, and zero below it', () => {
        expect(getSavingsProgressFraction(250, 1000)).toBe(0.25);
        expect(getSavingsProgressFraction(0, 1000)).toBe(0);
        expect(getSavingsProgressFraction(null, 1000)).toBe(0);
    });
});
