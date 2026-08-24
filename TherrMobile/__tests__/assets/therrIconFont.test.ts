import fs from 'fs';
import path from 'path';

const FONT_COPIES = [
    'resources/fonts/TherrFont.ttf',
    'android/app/src/main/assets/fonts/TherrFont.ttf',
].map((relative) => path.resolve(__dirname, '../..', relative));

interface IGlyphMetrics {
    index: number;
    leftSideBearing: number;
    xMin: number;
}

/**
 * Minimal TrueType reader: enough of `head`, `maxp`, `hhea`, `hmtx`, `loca` and the
 * `glyf` per-glyph headers to recover each glyph's declared left side bearing and the
 * left edge of its own bounding box. Deliberately dependency-free — pulling a font
 * library into the mobile package just to guard an asset is not worth it.
 */
const readGlyphMetrics = (file: Buffer): IGlyphMetrics[] => {
    const tables: Record<string, number> = {};
    const numTables = file.readUInt16BE(4);
    for (let i = 0; i < numTables; i += 1) {
        const record = 12 + (i * 16);
        tables[file.toString('ascii', record, record + 4)] = file.readUInt32BE(record + 8);
    }

    const numGlyphs = file.readUInt16BE(tables.maxp + 4);
    const numberOfHMetrics = file.readUInt16BE(tables.hhea + 34);
    const isLongLoca = file.readInt16BE(tables.head + 50) === 1;

    const locaAt = (index: number) => (isLongLoca
        ? file.readUInt32BE(tables.loca + (index * 4))
        : file.readUInt16BE(tables.loca + (index * 2)) * 2);

    // hmtx packs `numberOfHMetrics` (advance, lsb) pairs, then a tail of bare lsb values
    // for the monospaced run of trailing glyphs.
    const lsbAt = (index: number) => (index < numberOfHMetrics
        ? file.readInt16BE(tables.hmtx + (index * 4) + 2)
        : file.readInt16BE(tables.hmtx + (numberOfHMetrics * 4) + ((index - numberOfHMetrics) * 2)));

    const metrics: IGlyphMetrics[] = [];
    for (let index = 0; index < numGlyphs; index += 1) {
        const start = locaAt(index);
        // An empty outline (loca[n] === loca[n + 1]) has no glyf record and no bounding box.
        if (locaAt(index + 1) === start) {
            continue;
        }
        metrics.push({
            index,
            leftSideBearing: lsbAt(index),
            xMin: file.readInt16BE(tables.glyf + start + 2),
        });
    }

    return metrics;
};

describe('TherrFont.ttf', () => {
    it('ships an identical copy to the Android assets folder', () => {
        const [source, android] = FONT_COPIES.map((file) => fs.readFileSync(file));
        expect(android.equals(source)).toBe(true);
    });

    // TrueType requires a glyph's left side bearing to equal its bounding box's xMin.
    // When they disagree, FreeType — the rasterizer under both Android and iOS — slides
    // the outline by (lsb - xMin) so the ink meets the advertised bearing. An IcoMoon
    // rebuild of this font once recalculated every xMin but left every lsb at 0, which
    // dragged all 95 icons left by their own bearing (8px for "dots-horiz" at 24dp) and
    // shipped for months on the niche builds. react-native-vector-icons renders an icon
    // as a bare <Text>, so the laid-out box is the advance width and no amount of
    // flexbox centering can pull a displaced outline back. See
    // `resources/fonts/fix-icon-font-bearings.py`.
    it.each(FONT_COPIES)('declares a left side bearing matching each glyph box (%s)', (file) => {
        const offenders = readGlyphMetrics(fs.readFileSync(file))
            .filter(({ leftSideBearing, xMin }) => leftSideBearing !== xMin);

        expect(offenders).toEqual([]);
    });
});
