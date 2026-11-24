import { describe, expect, it } from '@jest/globals';
import {
    formatDropDay,
    formatDropDistance,
    getDistanceToDropMeters,
    getDropUserName,
} from '../../main/routes/Drops/dropDisplay';

/**
 * Drops (docs/DROPS.md). `openedOn` is deliberately a bare day — the server never tells a sender
 * the time a friend was at the spot — so the one thing this display layer must not do is shift
 * that day through the device's timezone.
 */
describe('drop display helpers', () => {
    it('formats the opened day without shifting it through the device timezone', () => {
        expect(formatDropDay('2026-11-21', 'en-us')).toContain('21');
        expect(formatDropDay('2026-01-01', 'en-us')).toContain('1');
        expect(formatDropDay('2026-01-01', 'en-us')).not.toContain('31');
    });

    it('passes through a value that is not a bare day', () => {
        expect(formatDropDay('', 'en-us')).toBe('');
        expect(formatDropDay('not-a-date', 'en-us')).toBe('not-a-date');
    });

    it('measures the distance to a drop only when the user position is known', () => {
        const drop = { latitude: 41.8826, longitude: -87.6226 };
        const meters = getDistanceToDropMeters({ latitude: 41.8835, longitude: -87.6226 }, drop);

        expect(meters).not.toBeNull();
        expect(meters as number).toBeGreaterThan(90);
        expect(meters as number).toBeLessThan(110);
        expect(getDistanceToDropMeters(null, drop)).toBeNull();
        expect(getDistanceToDropMeters({ latitude: undefined, longitude: undefined }, drop)).toBeNull();
    });

    it('formats a distance for display', () => {
        expect(formatDropDistance(100)).toMatch(/ft$/);
        expect(formatDropDistance(5000)).toMatch(/mi$/);
    });

    it('falls back to an empty name for a missing user', () => {
        expect(getDropUserName(null)).toBe('');
        expect(getDropUserName({ userName: 'sam' })).toBe('sam');
    });
});
