/**
 * @jest-environment jsdom
 */
import getReturnTo from '../../utilities/getReturnTo';

describe('getReturnTo', () => {
    it('returns the default fallback when there is no query string', () => {
        expect(getReturnTo()).toBe('/dashboard');
        expect(getReturnTo('')).toBe('/dashboard');
    });

    it('returns the fallback when returnTo is absent', () => {
        expect(getReturnTo('?rm=1&code=abc')).toBe('/dashboard');
    });

    it('honors a custom fallback', () => {
        expect(getReturnTo('?rm=1', '/settings')).toBe('/settings');
    });

    it('returns a valid relative path', () => {
        expect(getReturnTo('?returnTo=%2Fsettings%2Fapi-keys')).toBe('/settings/api-keys');
    });

    it('preserves a query string on the destination', () => {
        expect(getReturnTo('?returnTo=%2Fsettings%3Ftab%3Dkeys')).toBe('/settings?tab=keys');
    });

    it.each([
        ['//evil.com', 'protocol-relative URL'],
        ['/\\evil.com', 'backslash authority — browsers parse \\ as /'],
        ['https://evil.com', 'absolute URL'],
        ['javascript:alert(1)', 'javascript scheme'], // eslint-disable-line no-script-url
        ['settings', 'bare relative path'],
    ])('rejects %s (%s)', (candidate) => {
        // The handoff lands an authenticated session, so an attacker-controlled
        // destination would be worth stealing — anything but a plain path is refused.
        expect(getReturnTo(`?returnTo=${encodeURIComponent(candidate)}`)).toBe('/dashboard');
    });
});
