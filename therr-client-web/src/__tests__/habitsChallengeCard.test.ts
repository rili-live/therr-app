/**
 * @jest-environment jsdom
 */

/**
 * The share card actually rasterises: the WASM module loads from the root node_modules, the
 * bundled fonts are found, and the output is a 1200x630 PNG. A failure here is what would
 * otherwise only show up as every unfurl falling back to the generic brand image.
 */

import * as path from 'path';
import { TextDecoder, TextEncoder } from 'util';
import { buildChallengeCardSvg, renderSvgToPng } from '../utilities/habitsChallenge';

const FONTS_DIR = path.join(__dirname, '../assets/fonts');

describe('challenge share card', () => {
    // The suite runs under jsdom (test-setup.ts needs `document`), which hides Node's text
    // codecs. The server is plain Node, where both exist; resvg loads lazily, after this runs.
    beforeAll(() => {
        Object.assign(global, { TextEncoder, TextDecoder });
    });

    it('renders a 1200x630 PNG', async () => {
        const png = await renderSvgToPng(buildChallengeCardSvg({
            joinToken: 'AbCdEf123456',
            title: 'October miles',
            habitGoalId: 'goal',
            goal: { name: 'Run', amountUnit: 'km' },
            creator: { userName: 'casey', displayName: 'Casey' },
            startDate: '2026-10-01',
            endDate: '2026-10-30',
            status: 'active',
            hasStarted: true,
            hasEnded: false,
            daysLeft: 8,
            durationDays: 30,
            memberCount: 2,
            isFull: false,
            rankedBy: 'amount',
            standings: [{
                rank: 1, userName: 'casey', displayName: 'Casey', checkinDays: 4, totalAmount: 21,
            }],
        }), FONTS_DIR);

        expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        // IHDR: width and height are the first two big-endian uint32s of its data.
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
        // Twice in one process: initWasm must only ever run once.
        const again = await renderSvgToPng('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', FONTS_DIR);
        expect(again.subarray(0, 4).toString('hex')).toBe('89504e47');
    });
});
