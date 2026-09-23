import { expect } from 'chai';
import {
    MAX_SAVINGS_AMOUNT,
    hasReachedSavingsTarget,
    parseSavingsAmount,
    sumSavingsAmounts,
} from '../src/constants/savingsGoals';

/**
 * These pin the two things that make savings amounts different from ordinary numbers
 * here: the input is not trusted (a notification quick-reply is a free text field with
 * no form in front of it), and the arithmetic is money, where an IEEE double error of
 * 1e-16 is the difference between "goal reached" and "goal not reached".
 */
describe('parseSavingsAmount', () => {
    it('accepts a plain number and a plain numeric string', () => {
        expect(parseSavingsAmount(25).amount).to.equal(25);
        expect(parseSavingsAmount('25').amount).to.equal(25);
        expect(parseSavingsAmount('25.50').amount).to.equal(25.5);
    });

    it('treats an absent or empty value as "no amount recorded", not an error', () => {
        // The distinction the whole nullable column rests on: a check-in with no amount
        // is normal, and must not be rejected as a bad request.
        expect(parseSavingsAmount(undefined)).to.deep.equal({});
        expect(parseSavingsAmount(null)).to.deep.equal({});
        expect(parseSavingsAmount('')).to.deep.equal({});
    });

    it('strips the decoration a notification quick-reply arrives with', () => {
        expect(parseSavingsAmount('$25').amount).to.equal(25);
        expect(parseSavingsAmount(' 25.50 ').amount).to.equal(25.5);
        expect(parseSavingsAmount('USD 25').amount).to.equal(25);
        expect(parseSavingsAmount('€25,50').amount).to.equal(25.5);
    });

    it('resolves the decimal separator by shape rather than by guessing a locale', () => {
        // Last separator wins when both appear, which covers both conventions.
        expect(parseSavingsAmount('1,234.56').amount).to.equal(1234.56);
        expect(parseSavingsAmount('1.234,56').amount).to.equal(1234.56);
        // A lone separator with two trailing digits is a decimal point — this is what
        // makes a European user's "20,50" mean twenty-fifty and not two thousand fifty.
        expect(parseSavingsAmount('20,50').amount).to.equal(20.5);
        // A lone separator with exactly three trailing digits and one-to-three leading
        // ones is a thousands group. Deliberately resolved toward the larger reading;
        // see the note on normalizeDecimalSeparator.
        expect(parseSavingsAmount('1,234').amount).to.equal(1234);
        expect(parseSavingsAmount('1.234').amount).to.equal(1234);
        expect(parseSavingsAmount('1,234,567').amount).to.equal(1234567);
    });

    it('never silently multiplies an over-precise amount by dropping its decimal point', () => {
        // The regression behind the current rule: treating any unclassified separator
        // as grouping turned 25.5555 into 255555 and reported it back as a success —
        // a 1000x overstatement of someone's savings with nothing to notice it by.
        // Anything not confidently grouping stays a decimal, so it fails loudly instead.
        expect(parseSavingsAmount('25.5555').error).to.equal('too-precise');
        expect(parseSavingsAmount('12345.678').error).to.equal('too-precise');
    });

    it('rejects input with no digits in it', () => {
        expect(parseSavingsAmount('abc').error).to.equal('not-a-number');
        expect(parseSavingsAmount('$').error).to.equal('not-a-number');
        expect(parseSavingsAmount({}).error).to.equal('not-a-number');
        expect(parseSavingsAmount(Number.NaN).error).to.equal('not-a-number');
    });

    it('rejects a negative amount', () => {
        expect(parseSavingsAmount(-5).error).to.equal('negative');
        expect(parseSavingsAmount('-5').error).to.equal('negative');
    });

    it('rejects an amount past what numeric(12,2) can hold', () => {
        // Rejected here so it surfaces as a 400 rather than a Postgres overflow 500.
        expect(parseSavingsAmount(MAX_SAVINGS_AMOUNT).amount).to.equal(MAX_SAVINGS_AMOUNT);
        expect(parseSavingsAmount(MAX_SAVINGS_AMOUNT + 1).error).to.equal('too-large');
    });

    it('rejects more precision than a cent, without false positives', () => {
        expect(parseSavingsAmount(25.555).error).to.equal('too-precise');
        // 8.13 * 100 is 812.9999999999999 in IEEE arithmetic. A naive precision check
        // reports this — an ordinary two-decimal amount — as over-precise.
        expect(parseSavingsAmount(8.13).amount).to.equal(8.13);
        expect(parseSavingsAmount(0.07).amount).to.equal(0.07);
    });

    it('accepts zero, which is a real answer on a no-spend habit', () => {
        expect(parseSavingsAmount(0).amount).to.equal(0);
        expect(parseSavingsAmount('0').amount).to.equal(0);
    });
});

describe('sumSavingsAmounts', () => {
    it('adds in cents so repeated addition does not drift', () => {
        // Plain JS gives 0.9999999999999999 for this, which renders as "$1.00" and
        // compares as less than a 1.00 target.
        expect(sumSavingsAmounts(Array(10).fill(0.1))).to.equal(1);
        expect(sumSavingsAmounts([0.1, 0.2])).to.equal(0.3);
    });

    it('ignores nulls and unparseable entries rather than producing NaN', () => {
        expect(sumSavingsAmounts([10, null, undefined, 5])).to.equal(15);
        expect(sumSavingsAmounts([])).to.equal(0);
    });

    it('accepts the strings node-postgres returns for numeric columns', () => {
        expect(sumSavingsAmounts(['10.50', '4.50'])).to.equal(15);
    });
});

describe('hasReachedSavingsTarget', () => {
    it('is true at exactly the target', () => {
        expect(hasReachedSavingsTarget(100, 100)).to.equal(true);
    });

    it('is true for a total accumulated in floating point that lands on the target', () => {
        // The regression this function exists for: a saver who has met their goal to
        // the penny must not be told they have not.
        expect(hasReachedSavingsTarget(0.1 + 0.2, 0.3)).to.equal(true);
    });

    it('is false below the target and true above it', () => {
        expect(hasReachedSavingsTarget(99.99, 100)).to.equal(false);
        expect(hasReachedSavingsTarget(100.01, 100)).to.equal(true);
    });

    it('is never reached without a positive target', () => {
        // An open-ended savings habit has no finish line; a zero target would otherwise
        // complete every savings pact the moment it was created.
        expect(hasReachedSavingsTarget(500, null)).to.equal(false);
        expect(hasReachedSavingsTarget(500, undefined)).to.equal(false);
        expect(hasReachedSavingsTarget(500, 0)).to.equal(false);
    });

    it('compares numerically when either side is a numeric string', () => {
        // String comparison would make "900.00" > "1000.00" true.
        expect(hasReachedSavingsTarget('900.00', '1000.00')).to.equal(false);
        expect(hasReachedSavingsTarget('1000.00', '1000.00')).to.equal(true);
    });
});
