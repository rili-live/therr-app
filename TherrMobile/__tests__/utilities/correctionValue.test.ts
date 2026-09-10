import normalizeCorrectionValue from '../../main/utilities/correctionValue';

describe('correctionValue', () => {
    describe('phoneNumber', () => {
        it('canonicalizes a formatted US number to E.164', () => {
            expect(normalizeCorrectionValue('phoneNumber', '(415) 555-1234')).toEqual({
                ok: true,
                canonical: '+14155551234',
            });
        });

        it('accepts a US number with the 1 trunk prefix', () => {
            expect(normalizeCorrectionValue('phoneNumber', '1-415-555-1234')).toEqual({
                ok: true,
                canonical: '+14155551234',
            });
        });

        it('preserves an explicit country code', () => {
            expect(normalizeCorrectionValue('phoneNumber', '+44 20 7946 0958')).toEqual({
                ok: true,
                canonical: '+442079460958',
            });
        });

        it('strips a published extension, as the server does', () => {
            expect(normalizeCorrectionValue('phoneNumber', '(415) 555-1234 ext 2')).toEqual({
                ok: true,
                canonical: '+14155551234',
            });
            expect(normalizeCorrectionValue('phoneNumber', '415-555-1234 x22')).toEqual({
                ok: true,
                canonical: '+14155551234',
            });
        });

        it('rejects an empty value', () => {
            expect(normalizeCorrectionValue('phoneNumber', '   ')).toEqual({
                ok: false,
                error: 'EMPTY_PHONE',
            });
        });

        it('rejects NANP numbers whose area or exchange code starts with 0 or 1', () => {
            expect(normalizeCorrectionValue('phoneNumber', '0000000000')).toEqual({
                ok: false,
                error: 'INVALID_PHONE',
            });
            expect(normalizeCorrectionValue('phoneNumber', '415-055-1234')).toEqual({
                ok: false,
                error: 'INVALID_PHONE',
            });
        });

        it('rejects letters even when the digit count would pass', () => {
            expect(normalizeCorrectionValue('phoneNumber', 'call 415 555 1234')).toEqual({
                ok: false,
                error: 'INVALID_PHONE',
            });
        });

        it('rejects a number with too few digits', () => {
            expect(normalizeCorrectionValue('phoneNumber', '555-1234')).toEqual({
                ok: false,
                error: 'INVALID_PHONE',
            });
        });

        it('rejects a number past the E.164 length limit', () => {
            expect(normalizeCorrectionValue('phoneNumber', '+1234567890123456')).toEqual({
                ok: false,
                error: 'INVALID_PHONE',
            });
        });
    });

    describe('websiteUrl', () => {
        it('adds a scheme and strips www', () => {
            expect(normalizeCorrectionValue('websiteUrl', 'www.Example.com')).toEqual({
                ok: true,
                canonical: 'https://example.com',
            });
        });

        it('drops query strings, fragments and trailing slashes', () => {
            expect(normalizeCorrectionValue('websiteUrl', 'https://example.com/menu/?utm=x#top')).toEqual({
                ok: true,
                canonical: 'https://example.com/menu',
            });
        });

        it('drops default ports but keeps others', () => {
            expect(normalizeCorrectionValue('websiteUrl', 'https://example.com:443/')).toEqual({
                ok: true,
                canonical: 'https://example.com',
            });
            expect(normalizeCorrectionValue('websiteUrl', 'http://example.com:8080/x')).toEqual({
                ok: true,
                canonical: 'http://example.com:8080/x',
            });
        });

        it('drops credentials from the authority', () => {
            expect(normalizeCorrectionValue('websiteUrl', 'https://user:pass@example.com')).toEqual({
                ok: true,
                canonical: 'https://example.com',
            });
        });

        it('rejects an empty value', () => {
            expect(normalizeCorrectionValue('websiteUrl', ' ')).toEqual({
                ok: false,
                error: 'EMPTY_URL',
            });
        });

        it('rejects a hostname with no TLD', () => {
            expect(normalizeCorrectionValue('websiteUrl', 'notaurl')).toEqual({
                ok: false,
                error: 'INVALID_URL',
            });
        });

        it('rejects a value containing whitespace', () => {
            expect(normalizeCorrectionValue('websiteUrl', 'example .com')).toEqual({
                ok: false,
                error: 'INVALID_URL',
            });
        });
    });

    it('rejects an unsupported field', () => {
        expect(normalizeCorrectionValue('openingHours' as any, 'anything')).toEqual({
            ok: false,
            error: 'UNSUPPORTED_FIELD',
        });
    });
});
