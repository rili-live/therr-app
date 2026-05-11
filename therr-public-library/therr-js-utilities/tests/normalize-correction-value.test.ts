import { expect } from 'chai';
import normalizeCorrectionValue from '../src/normalize-correction-value';

describe('normalizeCorrectionValue', () => {
    describe('phoneNumber', () => {
        it('returns E.164 for a US number without country code (defaults to US)', () => {
            const result = normalizeCorrectionValue('phoneNumber', '(415) 555-1234');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized.startsWith('+1')).to.equal(true);
            }
        });

        it('returns E.164 for a number with country code', () => {
            const result = normalizeCorrectionValue('phoneNumber', '+44 20 7946 0958');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized).to.match(/^\+44/);
            }
        });

        it('two formats of the same US number normalize to the same value', () => {
            const a = normalizeCorrectionValue('phoneNumber', '415-555-1234');
            const b = normalizeCorrectionValue('phoneNumber', '(415) 555-1234');
            expect(a.ok && b.ok).to.equal(true);
            if (a.ok && b.ok) {
                expect(a.normalized).to.equal(b.normalized);
            }
        });

        it('rejects empty string', () => {
            const result = normalizeCorrectionValue('phoneNumber', '');
            expect(result.ok).to.equal(false);
        });

        it('rejects gibberish', () => {
            const result = normalizeCorrectionValue('phoneNumber', 'not-a-phone');
            expect(result.ok).to.equal(false);
        });

        it('rejects non-string input', () => {
            const result = normalizeCorrectionValue('phoneNumber', 12345);
            expect(result.ok).to.equal(false);
        });
    });

    describe('websiteUrl', () => {
        it('lowercases hostname', () => {
            const result = normalizeCorrectionValue('websiteUrl', 'HTTPS://Example.COM/path');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized).to.equal('https://example.com/path');
            }
        });

        it('strips leading www.', () => {
            const result = normalizeCorrectionValue('websiteUrl', 'https://www.example.com/');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized).to.equal('https://example.com');
            }
        });

        it('drops trailing slash from path', () => {
            const result = normalizeCorrectionValue('websiteUrl', 'https://example.com/about/');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized).to.equal('https://example.com/about');
            }
        });

        it('drops query and fragment', () => {
            const result = normalizeCorrectionValue('websiteUrl', 'https://example.com/?utm=foo#bar');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized).to.equal('https://example.com');
            }
        });

        it('drops default https port', () => {
            const result = normalizeCorrectionValue('websiteUrl', 'https://example.com:443/');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized).to.equal('https://example.com');
            }
        });

        it('injects https when scheme is missing', () => {
            const result = normalizeCorrectionValue('websiteUrl', 'example.com');
            expect(result.ok).to.equal(true);
            if (result.ok) {
                expect(result.normalized).to.equal('https://example.com');
            }
        });

        it('two equivalent URLs match after normalization', () => {
            const a = normalizeCorrectionValue('websiteUrl', 'http://www.Example.com/');
            const b = normalizeCorrectionValue('websiteUrl', 'http://example.com');
            expect(a.ok && b.ok).to.equal(true);
            if (a.ok && b.ok) {
                expect(a.normalized).to.equal(b.normalized);
            }
        });

        it('rejects empty string', () => {
            const result = normalizeCorrectionValue('websiteUrl', '');
            expect(result.ok).to.equal(false);
        });

        it('rejects non-string input', () => {
            const result = normalizeCorrectionValue('websiteUrl', { url: 'x' });
            expect(result.ok).to.equal(false);
        });
    });

    describe('openingHours', () => {
        const baseValue = {
            schema: ['Mon: 09:00-17:00', 'Tue: 09:00-17:00'],
            timezone: 'America/New_York',
        };

        it('accepts a well-formed value', () => {
            const result = normalizeCorrectionValue('openingHours', baseValue);
            expect(result.ok).to.equal(true);
        });

        it('produces stable output regardless of key insertion order', () => {
            const a = normalizeCorrectionValue('openingHours', {
                schema: baseValue.schema,
                timezone: baseValue.timezone,
            });
            const b = normalizeCorrectionValue('openingHours', {
                timezone: baseValue.timezone,
                schema: baseValue.schema,
            });
            expect(a.ok && b.ok).to.equal(true);
            if (a.ok && b.ok) {
                expect(a.normalized).to.equal(b.normalized);
            }
        });

        it('collapses whitespace in schema entries', () => {
            const a = normalizeCorrectionValue('openingHours', {
                schema: ['Mon:  09:00-17:00 '],
                timezone: 'America/New_York',
            });
            const b = normalizeCorrectionValue('openingHours', {
                schema: ['Mon: 09:00-17:00'],
                timezone: 'America/New_York',
            });
            expect(a.ok && b.ok).to.equal(true);
            if (a.ok && b.ok) {
                expect(a.normalized).to.equal(b.normalized);
            }
        });

        it('rejects missing schema', () => {
            const result = normalizeCorrectionValue('openingHours', { timezone: 'UTC' });
            expect(result.ok).to.equal(false);
        });

        it('rejects empty schema array', () => {
            const result = normalizeCorrectionValue('openingHours', { schema: [], timezone: 'UTC' });
            expect(result.ok).to.equal(false);
        });

        it('rejects missing timezone', () => {
            const result = normalizeCorrectionValue('openingHours', { schema: ['Mon: 09:00-17:00'] });
            expect(result.ok).to.equal(false);
        });

        it('rejects null input', () => {
            const result = normalizeCorrectionValue('openingHours', null);
            expect(result.ok).to.equal(false);
        });
    });

    describe('unsupported field', () => {
        it('returns an error for an unknown fieldName', () => {
            // @ts-expect-error intentional bad input
            const result = normalizeCorrectionValue('somethingElse', 'x');
            expect(result.ok).to.equal(false);
        });
    });
});
