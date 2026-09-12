import fs from 'fs';
import path from 'path';

/**
 * NICHE(HABITS): guards the Android status-bar (small) notification icon.
 *
 * `ic_notification_icon` shipped as the Therr "T" mark on this branch for the whole
 * life of Friends with Habits: it is inherited from `general` and nothing about a
 * niche build overrides drawables, so every HABITS push showed the wrong company's
 * logo in the status bar. Nothing catches that — the resource resolves, the build is
 * green, and the *expanded* notification shows the correct app icon and name, so the
 * only place the bug is visible is a 24dp collapsed status-bar glyph.
 *
 * Re-inheriting it is the realistic regression: `general` is merged down into this
 * branch routinely, and if it ever touches this file the merge takes its side without
 * a conflict. Hence the provenance assertion below.
 *
 * The geometry assertions exist because the failure mode of an Android notification
 * icon is silent in a second way: the system reads the **alpha channel only**, so a
 * fill rule that closes the eye holes, or artwork that overflows the 24dp canvas,
 * still builds and still renders — just wrongly.
 */

const RES_DIR = path.resolve(__dirname, '../..', 'android/app/src/main/res');
const VECTOR = path.join(RES_DIR, 'drawable-anydpi-v24/ic_notification_icon.xml');

// `minSdkVersion` is 25 and `anydpi` outranks every density qualifier, so these PNGs
// are never selected on a supported device. They are kept only so the two
// representations of the icon cannot drift apart.
const DENSITY_PNGS: [string, number][] = [
    ['mdpi', 24],
    ['hdpi', 36],
    ['xhdpi', 48],
    ['xxhdpi', 72],
    ['xxxhdpi', 96],
];

const CANVAS_DP = 24;

const readVector = () => fs.readFileSync(VECTOR, 'utf8');

const attr = (source: string, name: string): string => {
    const match = source.match(new RegExp(`android:${name}="([^"]*)"`));
    if (!match) {
        throw new Error(`ic_notification_icon.xml is missing android:${name}`);
    }
    return match[1];
};

/** Bounds of the drawn artwork in dp, after the <group> transform. */
const artworkBounds = (source: string) => {
    const pathData = attr(source, 'pathData');
    const scale = parseFloat(attr(source, 'scaleX'));
    const translateX = parseFloat(attr(source, 'translateX'));
    const translateY = parseFloat(attr(source, 'translateY'));

    // The generator emits closed polylines only (M/L/Z), so every coordinate pair in
    // the data is an on-curve point and a plain scan gives exact bounds.
    const coords = pathData.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) || [];
    expect(coords.length).toBeGreaterThan(100);

    const xs = coords.map((pair) => (parseFloat(pair.split(',')[0]) * scale) + translateX);
    const ys = coords.map((pair) => (parseFloat(pair.split(',')[1]) * scale) + translateY);

    return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
    };
};

describe('Android notification small icon', () => {
    it('is generated from the Friends with Habits logo, not inherited from general', () => {
        const source = readVector();

        expect(source).toContain('build-notification-icon.py');
        expect(source).toContain('habits-logo.svg');
        expect(fs.existsSync(path.resolve(__dirname, '../..', 'resources/icons/build-notification-icon.py'))).toBe(true);
    });

    it('declares the 24dp canvas Android expects for a status-bar icon', () => {
        const source = readVector();

        expect(attr(source, 'width')).toBe('24dp');
        expect(attr(source, 'height')).toBe('24dp');
        expect(attr(source, 'viewportWidth')).toBe(String(CANVAS_DP));
        expect(attr(source, 'viewportHeight')).toBe(String(CANVAS_DP));
    });

    it('keeps the chameleon eyes as holes rather than solid fill', () => {
        const source = readVector();

        // One path, so the whole glyph shares a single fill rule. evenOdd is what turns
        // the sclera sub-paths into holes; nonZero would fill them and the icon would
        // become an eyeless blob that still builds and still renders.
        expect(source.match(/<path/g)).toHaveLength(1);
        expect(attr(source, 'fillType')).toBe('evenOdd');

        // Silhouette + two sclera holes + two pupils. Fewer means the eyes were lost.
        const subPaths = (attr(source, 'pathData').match(/M/g) || []).length;
        expect(subPaths).toBeGreaterThanOrEqual(5);
    });

    it('fits inside the canvas and stays vertically centred', () => {
        const { left, right, top, bottom } = artworkBounds(readVector());

        expect(left).toBeGreaterThanOrEqual(0.5);
        expect(right).toBeLessThanOrEqual(CANVAS_DP - 0.5);
        expect(top).toBeGreaterThan(0);
        expect(bottom).toBeLessThan(CANVAS_DP);

        expect(top).toBeCloseTo(CANVAS_DP - bottom, 1);

        // The chameleon head reads much wider than tall once the eyes are included.
        // The Therr mark it replaced is a circle, so this is also what fails first if
        // that mark is ever restored here.
        const aspect = (right - left) / (bottom - top);
        expect(aspect).toBeGreaterThan(1.45);
        expect(aspect).toBeLessThan(1.75);
    });

    it.each(DENSITY_PNGS)('ships a %s raster fallback at %ipx', (density, size) => {
        const file = fs.readFileSync(path.join(RES_DIR, `drawable-${density}/ic_notification_icon.png`));

        expect(file.toString('ascii', 1, 4)).toBe('PNG');
        expect(file.readUInt32BE(16)).toBe(size);
        expect(file.readUInt32BE(20)).toBe(size);
    });
});
