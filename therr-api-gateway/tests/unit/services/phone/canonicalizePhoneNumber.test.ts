/**
 * Unit tests for the phone-number canonicalization used by the passwordless flows.
 *
 * Regression guard: the original helper was called `toE164` and asserted its result matched
 * `/^\+[1-9]\d{6,14}$/`. But `normalizePhoneNumber` returns a *display* format — `+13175551234`
 * comes back as `"+1 317-555-1234"` — so the assertion failed for every possible input and
 * `POST /v1/phone/auth/start` answered 400 to every sign-in attempt. The first two tests below
 * fail against that implementation.
 */
import { expect } from 'chai';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import canonicalizePhoneNumber from '../../../../src/services/phone/canonicalizePhoneNumber';

describe('canonicalizePhoneNumber', () => {
    describe('accepts what users actually type', () => {
        const equivalentInputs = [
            '+13175551234',
            '+1 (317) 555-1234',
            '+1 317-555-1234',
            '317-555-1234',
            '3175551234',
            '(317) 555 1234',
        ];

        equivalentInputs.forEach((input) => {
            it(`accepts ${JSON.stringify(input)}`, () => {
                expect(canonicalizePhoneNumber(input)).to.not.equal(undefined);
            });
        });

        it('converges every spelling of the same number on one canonical pair', () => {
            const results = equivalentInputs.map((input) => canonicalizePhoneNumber(input));

            results.forEach((result) => {
                expect(result?.e164).to.equal('+13175551234');
                expect(result?.canonical).to.equal('+1 317-555-1234');
            });
        });
    });

    describe('agrees with how phone numbers are stored', () => {
        it('produces exactly what the existing phone-verification flow writes to main.users', () => {
            // The gateway's /phone/verify route caches `normalizePhoneNumber(input)` and the
            // users-service writes that value straight to `main.users.phoneNumber`. Sign-in
            // has to arrive at the same string or the account lookup finds nothing — and,
            // because /auth/start is enumeration-safe, that failure is silent.
            const asStoredByVerifyFlow = normalizePhoneNumber('+13175551234');

            expect(canonicalizePhoneNumber('3175551234')?.canonical).to.equal(asStoredByVerifyFlow);
            expect(canonicalizePhoneNumber('+13175551234')?.canonical).to.equal(asStoredByVerifyFlow);
        });

        it('is idempotent, so re-canonicalizing a stored value is a no-op', () => {
            const once = canonicalizePhoneNumber('+13175551234');
            const twice = canonicalizePhoneNumber(once?.canonical);

            expect(twice?.canonical).to.equal(once?.canonical);
            expect(twice?.e164).to.equal(once?.e164);
        });
    });

    describe('international numbers', () => {
        // An allocated GB *mobile* range. Two ranges to avoid: a landline such as
        // +44 20 7946 0958, which this helper accepts but `phoneAuthStartValidation`'s
        // `isMobilePhone` rejects before the router ever runs; and Ofcom's fictional-drama
        // range (+44 7700 900xxx), which is the reverse — `isMobilePhone` waves it through
        // but libphonenumber marks it invalid. Either would describe a path production
        // cannot reach.
        it('honours an explicit country code over the default region', () => {
            const result = canonicalizePhoneNumber('+44 7911 123456');

            expect(result?.e164).to.equal('+447911123456');
            // Twilio's sender selection keys off this prefix.
            expect(result?.e164.startsWith('+44')).to.equal(true);
        });

        it('rejects a non-default-region number given without a country code', () => {
            // Better to refuse than to silently reinterpret a GB number as American.
            expect(canonicalizePhoneNumber('447911123456')).to.equal(undefined);
        });
    });

    describe('rejects what is not a phone number', () => {
        [
            ['too short', '1234567'],
            ['letters', 'not-a-phone'],
            ['empty', ''],
            ['whitespace only', '   '],
            ['undefined', undefined],
            ['null', null],
            ['far too long', '+123456789012345678'],
        ].forEach(([label, input]) => {
            it(`rejects ${label}`, () => {
                expect(canonicalizePhoneNumber(input)).to.equal(undefined);
            });
        });
    });
});
