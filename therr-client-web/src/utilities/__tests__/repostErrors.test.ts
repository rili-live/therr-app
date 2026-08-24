/**
 * @jest-environment jsdom
 */
import getRepostErrorKey from '../repostErrors';

describe('getRepostErrorKey', () => {
    it('names the duplicate guard on a 400', () => {
        expect(getRepostErrorKey(400)).toBe('pages.exploreThoughts.repostDuplicate');
    });

    // Retrying never clears a 403, so it must not fall through to the generic
    // "please try again" copy.
    it('names the access rule on a 403 rather than the retryable error', () => {
        expect(getRepostErrorKey(403)).toBe('pages.exploreThoughts.repostRestricted');
    });

    it('falls back to the generic error for a server fault', () => {
        expect(getRepostErrorKey(500)).toBe('pages.exploreThoughts.repostError');
    });

    it('falls back to the generic error when the request never got a status', () => {
        expect(getRepostErrorKey(undefined)).toBe('pages.exploreThoughts.repostError');
    });
});
