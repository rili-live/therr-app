import { expect } from 'chai';
import isValidSignupAge, { MINIMUM_SIGNUP_AGE, getAgeFromBirthdate } from '../src/is-valid-signup-age';

const isoYearsAgo = (years: number, extraDays = 0): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setDate(d.getDate() + extraDays);
    return d.toISOString();
};

describe('isValidSignupAge', () => {
    it('accepts a user comfortably older than the minimum age', () => {
        expect(isValidSignupAge(isoYearsAgo(30))).to.equal(true);
    });

    it('accepts a user exactly at the minimum age', () => {
        // born MINIMUM_SIGNUP_AGE years ago minus a day → already had birthday
        expect(isValidSignupAge(isoYearsAgo(MINIMUM_SIGNUP_AGE, -1))).to.equal(true);
    });

    it('rejects a user one day short of the minimum age', () => {
        // birthday is tomorrow → still one year under
        expect(isValidSignupAge(isoYearsAgo(MINIMUM_SIGNUP_AGE, 1))).to.equal(false);
    });

    it('rejects a clearly under-age user', () => {
        expect(isValidSignupAge(isoYearsAgo(5))).to.equal(false);
    });

    it('rejects a future birthdate', () => {
        expect(isValidSignupAge(isoYearsAgo(-5))).to.equal(false);
    });

    it('rejects an unparseable date', () => {
        expect(isValidSignupAge('not-a-date')).to.equal(false);
    });

    it('respects a custom minimum age override', () => {
        const seventeen = isoYearsAgo(17);
        expect(isValidSignupAge(seventeen, 18)).to.equal(false);
        expect(isValidSignupAge(seventeen, 16)).to.equal(true);
    });
});

describe('getAgeFromBirthdate', () => {
    it('computes whole-year age', () => {
        expect(getAgeFromBirthdate(isoYearsAgo(25))).to.equal(25);
    });

    it('returns NaN for invalid input', () => {
        expect(Number.isNaN(getAgeFromBirthdate('garbage'))).to.equal(true);
    });
});
