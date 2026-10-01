import { describe, expect, it } from '@jest/globals';
import {
    PLEDGE_AMOUNT_PRESETS,
    canAddPactPledge,
    canEditPactPledge,
    getStartOfLocalWeek,
    getValidPledge,
    isPledgeStartingNextWeek,
} from '../../main/utilities/pactPledge';

const pledge = { amount: 5, charityKey: 'give_directly', pledgedAt: '2026-09-29T12:00:00.000Z' } as any;
const activeMember = { userId: 'me', status: 'active', pledge } as any;

describe('pactPledge', () => {
    it('offers only amounts the server accepts (whole USD, 1–500)', () => {
        expect(PLEDGE_AMOUNT_PRESETS.length).toBeGreaterThan(0);
        PLEDGE_AMOUNT_PRESETS.forEach((amount) => {
            expect(Number.isInteger(amount)).toBe(true);
            expect(amount).toBeGreaterThanOrEqual(1);
            expect(amount).toBeLessThanOrEqual(500);
        });
    });

    describe('canEditPactPledge — mirrors the server guard', () => {
        it('allows an active member of a pending or active pact', () => {
            expect(canEditPactPledge({ status: 'active' } as any, activeMember, false)).toBe(true);
            expect(canEditPactPledge({ status: 'pending' } as any, activeMember, false)).toBe(true);
        });

        it('refuses a pending invitee, a finished pact, and a pact past its end date', () => {
            expect(canEditPactPledge({ status: 'active' } as any, { ...activeMember, status: 'pending' }, false)).toBe(false);
            expect(canEditPactPledge({ status: 'completed' } as any, activeMember, false)).toBe(false);
            expect(canEditPactPledge({ status: 'active' } as any, activeMember, true)).toBe(false);
            expect(canEditPactPledge(undefined, activeMember, false)).toBe(false);
            expect(canEditPactPledge({ status: 'active' } as any, undefined, false)).toBe(false);
        });
    });

    it('offers a new pledge only on a pact with partners', () => {
        expect(canAddPactPledge({ isSolo: false } as any)).toBe(true);
        expect(canAddPactPledge({} as any)).toBe(true);
        expect(canAddPactPledge({ isSolo: true } as any)).toBe(false);
    });

    it('treats a missing, malformed or unknown-charity pledge as none', () => {
        expect(getValidPledge(activeMember)).toEqual(pledge);
        expect(getValidPledge({ ...activeMember, pledge: null })).toBeNull();
        expect(getValidPledge(undefined)).toBeNull();
        expect(getValidPledge({ ...activeMember, pledge: { ...pledge, charityKey: 'not_a_charity' } })).toBeNull();
        expect(getValidPledge({ ...activeMember, pledge: { ...pledge, amount: 'x' } })).toBeNull();
    });

    describe('isPledgeStartingNextWeek', () => {
        it('finds local Monday midnight from any day of the week, Sunday included', () => {
            const wednesday = new Date(2026, 8, 30, 15, 0);
            const sunday = new Date(2026, 9, 4, 23, 0);
            [wednesday, sunday].forEach((day) => {
                const start = getStartOfLocalWeek(day);
                expect(start.getDay()).toBe(1);
                expect(start.getHours()).toBe(0);
                expect(start.getDate()).toBe(28);
            });
            expect(getStartOfLocalWeek(new Date(2026, 8, 28, 0, 0)).getDate()).toBe(28);
        });

        it('is true for a pledge made after this week began, false for one already in force', () => {
            const now = new Date(2026, 9, 1, 12, 0);
            const madeTuesday = { ...pledge, pledgedAt: new Date(2026, 8, 29, 9, 0).toISOString() };
            const madeLastWeek = { ...pledge, pledgedAt: new Date(2026, 8, 24, 9, 0).toISOString() };
            expect(isPledgeStartingNextWeek(madeTuesday, now)).toBe(true);
            expect(isPledgeStartingNextWeek(madeLastWeek, now)).toBe(false);
            expect(isPledgeStartingNextWeek({ ...pledge, pledgedAt: 'garbage' }, now)).toBe(false);
        });
    });
});
