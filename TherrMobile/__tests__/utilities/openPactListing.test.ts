import { describe, expect, it } from '@jest/globals';
import translator from '../../main/utilities/translator';
import {
    getOpenPactSeats, getOpenPactSeatsLabel, MAX_SEAT_DOTS,
} from '../../main/utilities/openPactListing';

/**
 * The seat line on an open-pact card (OpenPacts screen and feed). The ceiling comes from the server
 * and may be absent on an older one, in which case the card counts members rather than guess "of N".
 */

const labelFor = (memberCount: number, maxMembers: number | null, locale = 'en-us') => {
    const { key, params } = getOpenPactSeatsLabel(getOpenPactSeats(memberCount, maxMembers));
    return translator(locale, key, params);
};

describe('getOpenPactSeats', () => {
    it('counts the seats left under the server ceiling', () => {
        expect(getOpenPactSeats(4, 6)).toEqual({
            filled: 4, total: 6, left: 2, showDots: true,
        });
    });

    it('has no ceiling, and draws no dots, when the server sent none', () => {
        expect(getOpenPactSeats(4, null)).toEqual({
            filled: 4, total: null, left: null, showDots: false,
        });
    });

    it('never reports negative seats when a stale count exceeds the ceiling', () => {
        expect(getOpenPactSeats(7, 6)).toEqual({
            filled: 7, total: 7, left: 0, showDots: true,
        });
    });

    it('stops drawing dots past the glanceable limit', () => {
        expect(getOpenPactSeats(2, MAX_SEAT_DOTS + 1).showDots).toBe(false);
    });

    it('treats a missing member count as nobody', () => {
        expect(getOpenPactSeats(undefined, 6).filled).toBe(0);
    });
});

describe('getOpenPactSeatsLabel', () => {
    it('says how many spots are left', () => {
        expect(labelFor(4, 6)).toBe('2 spots left');
    });

    it('uses the singular for the last spot', () => {
        expect(labelFor(5, 6)).toBe('1 spot left');
    });

    it('counts members when the ceiling is unknown', () => {
        expect(labelFor(4, null)).toBe('4 members');
        expect(labelFor(1, null)).toBe('1 member');
    });

    it('resolves in every locale', () => {
        ['en-us', 'es', 'fr-ca'].forEach((locale) => {
            expect(labelFor(4, 6, locale)).not.toMatch(/pages\.|\{/);
            expect(labelFor(1, null, locale)).not.toMatch(/pages\.|\{/);
        });
    });
});
