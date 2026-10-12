// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import {
    bodyPath,
    gemAt,
    getGemFlights,
    getPileRows,
    getPileSlots,
    tongueShape,
} from '../../main/components/Celebrations/ChameleonCatch/rig';
import {
    GEM_PILE,
    MOUTH,
    SCENE_HEIGHT,
    SCENE_WIDTH,
    TONGUE,
} from '../../main/components/Celebrations/ChameleonCatch/geometry';
import { GEM_CLOCK_MS } from '../../main/components/Celebrations/ChameleonCatch/motion';

/**
 * The daily-bonus scene's math. The gems are closed-form physics read off one clock, so the
 * properties that make the burst read right can be checked without rendering a frame: every gem
 * comes down exactly on its slot in the pile, the pile builds from the ground up, and nothing
 * leaves the scene (which would clip, or change the layout around it).
 */

// Every gem count the reveal can produce: getGemCount's 5–16, plus a jackpot's top-up.
const GEM_COUNTS = Array.from({ length: 16 + GEM_PILE.jackpotExtra - 4 }, (_, index) => index + 5);
const CLOCK_END = GEM_CLOCK_MS / 1000;

describe('ChameleonCatch rig — the gem pile', () => {
    it('gives every gem a place, bottom row widest', () => {
        GEM_COUNTS.forEach((count) => {
            const rows = getPileRows(count);
            expect(rows.reduce((sum, row) => sum + row, 0)).toBe(count);
            rows.slice(1).forEach((row, index) => expect(row).toBeLessThan(rows[index]));
            expect(getPileSlots(count)).toHaveLength(count);
        });
    });

    it('lands each gem exactly on its slot and leaves it there at its rest tilt', () => {
        GEM_COUNTS.forEach((count) => {
            getGemFlights(count).forEach((flight) => {
                const touchdown = gemAt(flight, flight.delay + flight.landAt);
                expect(touchdown.x).toBeCloseTo(flight.slot.x, 3);
                expect(touchdown.y).toBeCloseTo(flight.slot.y, 3);
                // Whole turns over the flight, so it touches down already at its tilt.
                const turns = (touchdown.rotate - flight.slot.tilt) / 360;
                expect(Math.abs(turns - Math.round(turns))).toBeCloseTo(0, 6);

                const atRest = gemAt(flight, CLOCK_END);
                expect(atRest).toEqual({
                    x: flight.slot.x, y: flight.slot.y, rotate: flight.slot.tilt, launched: true,
                });
            });
        });
    });

    it('builds the pile from the ground up', () => {
        GEM_COUNTS.forEach((count) => {
            const flights = getGemFlights(count);
            const landingByRow = new Map<number, number[]>();
            flights.forEach((flight) => {
                const landings = landingByRow.get(flight.slot.row) || [];
                landings.push(flight.delay + flight.landAt);
                landingByRow.set(flight.slot.row, landings);
            });
            const meanLanding = [...landingByRow.keys()].sort()
                .map((row) => {
                    const landings = landingByRow.get(row)!;
                    return landings.reduce((sum, at) => sum + at, 0) / landings.length;
                });
            meanLanding.slice(1).forEach((at, index) => expect(at).toBeGreaterThan(meanLanding[index]));
        });
    });

    it('keeps every gem inside the scene for the whole flight', () => {
        const steps = 140;
        GEM_COUNTS.forEach((count) => {
            getGemFlights(count, count - GEM_PILE.jackpotExtra, 0.25).forEach((flight) => {
                for (let step = 0; step <= steps; step += 1) {
                    const at = gemAt(flight, (step / steps) * CLOCK_END);
                    expect(at.x).toBeGreaterThan(0);
                    expect(at.x).toBeLessThan(SCENE_WIDTH);
                    expect(at.y).toBeGreaterThan(0);
                    expect(at.y).toBeLessThan(SCENE_HEIGHT);
                }
            });
        });
    });

    it('settles every gem, second volley included, before the clock stops', () => {
        const flights = getGemFlights(21, 16, 0.25);
        flights.forEach((flight) => {
            expect(gemAt(flight, CLOCK_END).y).toBe(flight.slot.y);
        });
    });
});

describe('ChameleonCatch rig — paths', () => {
    it('builds the back and tail for every coil the idle breathing reaches', () => {
        [0.94, 1, 1.06].forEach((coil) => {
            const d = bodyPath(coil);
            expect(d.startsWith('M ')).toBe(true);
            expect(d.endsWith('Z')).toBe(true);
            expect(d).not.toMatch(/NaN|Infinity/);
        });
    });

    it('draws nothing at the mouth while the tongue is in', () => {
        expect(tongueShape(MOUTH, TONGUE.target, 0).tipRadius).toBe(0);
        expect(tongueShape(MOUTH, TONGUE.target, -0.05).tipRadius).toBe(0);
        const out = tongueShape(MOUTH, TONGUE.target, 1);
        expect(out.tipX).toBeCloseTo(TONGUE.target[0]);
        expect(out.tipY).toBeCloseTo(TONGUE.target[1]);
        expect(out.tipRadius).toBe(TONGUE.tipRadius);
    });
});
