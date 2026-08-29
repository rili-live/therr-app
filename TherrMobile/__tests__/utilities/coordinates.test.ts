import { firstUsableCoordinate, hasUsableCoords, isUsableCoordinate } from '../../main/utilities/coordinates';

describe('coordinates', () => {
    describe('isUsableCoordinate', () => {
        it('accepts zero, the value a truthiness check drops', () => {
            expect(isUsableCoordinate(0)).toBe(true);
        });

        it('accepts ordinary positive and negative coordinates', () => {
            expect(isUsableCoordinate(37.7749)).toBe(true);
            expect(isUsableCoordinate(-122.4194)).toBe(true);
        });

        it('rejects absent, non-numeric and non-finite values', () => {
            [undefined, null, NaN, Infinity, -Infinity, '37.7749', {}, []].forEach((value) => {
                expect(isUsableCoordinate(value)).toBe(false);
            });
        });
    });

    describe('hasUsableCoords', () => {
        // The regression this guards: the map preview strip filtered areas with
        // `a.latitude && a.longitude`, so a space on the prime meridian or the equator
        // never appeared in the strip at all.
        it('keeps a point on the prime meridian', () => {
            expect(hasUsableCoords({ latitude: 51.4779, longitude: 0 })).toBe(true);
        });

        it('keeps a point on the equator', () => {
            expect(hasUsableCoords({ latitude: 0, longitude: -78.4678 })).toBe(true);
        });

        it('keeps Null Island, where both components are zero', () => {
            expect(hasUsableCoords({ latitude: 0, longitude: 0 })).toBe(true);
        });

        it('rejects a point missing either component', () => {
            expect(hasUsableCoords({ latitude: 51.4779 })).toBe(false);
            expect(hasUsableCoords({ longitude: -0.0015 })).toBe(false);
        });

        it('rejects a malformed payload rather than throwing', () => {
            expect(hasUsableCoords(undefined)).toBe(false);
            expect(hasUsableCoords(null)).toBe(false);
            expect(hasUsableCoords({ latitude: 'a', longitude: 'b' })).toBe(false);
            expect(hasUsableCoords({ latitude: NaN, longitude: 0 })).toBe(false);
        });
    });

    describe('firstUsableCoordinate', () => {
        // The regression this guards: `routeLongitude || lastKnownLongitude || DEFAULT`
        // skipped a route param of exactly 0 and centred the map on the default instead.
        it('returns a leading zero rather than falling through it', () => {
            expect(firstUsableCoordinate(0, 51.4779, -87.6298)).toBe(0);
        });

        it('falls through absent and non-finite candidates', () => {
            expect(firstUsableCoordinate(undefined, null, NaN, 41.8781)).toBe(41.8781);
        });

        it('keeps the declared preference order', () => {
            expect(firstUsableCoordinate(41.8781, 0)).toBe(41.8781);
        });

        it('returns undefined when nothing is usable', () => {
            expect(firstUsableCoordinate(undefined, null, 'nope')).toBeUndefined();
            expect(firstUsableCoordinate()).toBeUndefined();
        });
    });
});
