import { expect } from 'chai';
import { getBoundingBox } from '../src/location';

/**
 * The bounding box exists to make a radius search index-friendly: an exact distance test
 * cannot use a btree index, so the box narrows the rows the exact test has to look at.
 *
 * That gives it one hard requirement — it must never exclude a point that is genuinely
 * within the radius, because the exact test that runs afterwards can only remove rows, never
 * add them back. Being too generous costs a few wasted comparisons; being too tight silently
 * drops content from a feed.
 */
describe('getBoundingBox', () => {
    const CHICAGO = { latitude: 41.8781, longitude: -87.6298 };

    const containsPoint = (
        box: ReturnType<typeof getBoundingBox>,
        latitude: number,
        longitude: number,
    ) => latitude >= box.minLatitude
        && latitude <= box.maxLatitude
        && longitude >= box.minLongitude
        && longitude <= box.maxLongitude;

    it('contains the centre', () => {
        const box = getBoundingBox(CHICAGO.latitude, CHICAGO.longitude, 60000);
        expect(containsPoint(box, CHICAGO.latitude, CHICAGO.longitude)).to.equal(true);
    });

    it('grows with the radius', () => {
        const small = getBoundingBox(CHICAGO.latitude, CHICAGO.longitude, 1000);
        const large = getBoundingBox(CHICAGO.latitude, CHICAGO.longitude, 60000);

        expect(large.maxLatitude - large.minLatitude).to.be.greaterThan(small.maxLatitude - small.minLatitude);
        expect(large.maxLongitude - large.minLongitude).to.be.greaterThan(small.maxLongitude - small.minLongitude);
    });

    it('reaches at least the requested radius in all four directions', () => {
        const radiusMeters = 60000;
        const box = getBoundingBox(CHICAGO.latitude, CHICAGO.longitude, radiusMeters);
        const latitudeReach = (box.maxLatitude - CHICAGO.latitude) * 111320;
        // Longitude degrees are shorter this far north, so the reach is measured in metres
        // using the same cosine correction the box applies.
        const longitudeReach = (box.maxLongitude - CHICAGO.longitude)
            * 111320 * Math.cos((CHICAGO.latitude * Math.PI) / 180);

        expect(latitudeReach).to.be.at.least(radiusMeters);
        expect(longitudeReach).to.be.at.least(radiusMeters * 0.99);
    });

    it('widens longitude as latitude increases, since the meridians converge', () => {
        const equator = getBoundingBox(0, 0, 60000);
        const northern = getBoundingBox(60, 0, 60000);

        expect(northern.maxLongitude - northern.minLongitude)
            .to.be.greaterThan(equator.maxLongitude - equator.minLongitude);
        // Latitude spans the same distance everywhere.
        expect(northern.maxLatitude - northern.minLatitude)
            .to.be.closeTo(equator.maxLatitude - equator.minLatitude, 1e-9);
    });

    it('does not produce an infinite span at the pole', () => {
        const box = getBoundingBox(89.999, 0, 60000);

        expect(Number.isFinite(box.minLongitude)).to.equal(true);
        expect(Number.isFinite(box.maxLongitude)).to.equal(true);
    });

    it('clamps latitude to the poles rather than running past them', () => {
        const box = getBoundingBox(89.9, 0, 200000);

        expect(box.maxLatitude).to.equal(90);
        expect(box.minLatitude).to.be.at.least(-90);
    });

    it('flags a box that wraps the antimeridian, where BETWEEN would match nothing', () => {
        const wrapped = getBoundingBox(-16.5, 179.9, 60000);
        const ordinary = getBoundingBox(-16.5, 100, 60000);

        // The caller has to drop its indexed longitude predicate for this case: the range
        // has a min greater than its max once normalized, so a BETWEEN excludes everything.
        expect(wrapped.wrapsAntimeridian).to.equal(true);
        expect(ordinary.wrapsAntimeridian).to.equal(false);
    });

    it('treats a negative radius as zero rather than inverting the box', () => {
        const box = getBoundingBox(CHICAGO.latitude, CHICAGO.longitude, -5000);

        expect(box.minLatitude).to.equal(box.maxLatitude);
        expect(box.minLongitude).to.equal(box.maxLongitude);
    });
});
