import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { it, describe, expect, jest } from '@jest/globals';

/**
 * `SplashLogoSpinner` blinks the HABITS chameleon by sweeping a lid over each eye, and it
 * places those lids from hard-coded fractions of the logo box. Nothing in the app checks
 * that the fractions still land on the artwork: regenerate `bootsplash_logo.png` (per
 * `main/assets/habits-icons/README.md`) with the chameleon a few percent higher or smaller
 * and the lids quietly blink somewhere on its forehead instead.
 *
 * So re-measure the committed artwork here and hold the constants to it. The eye whites are
 * the only pure-white shapes in the upper half of the logo, which makes them findable
 * without decoding the design intent.
 *
 * Both bitmaps the overlay can draw are measured: the bundled JS copy (iOS, and the fallback
 * everywhere) and the Android drawable the native splash itself draws. The drawable is also
 * held to the 288dp canvas Android renders a splash logo in, because the overlay sizes itself
 * to that canvas — regenerate the drawables the way react-native-bootsplash's own generator
 * would (a 100dp logo centered in the canvas) and the overlay would draw the logo at 2.9x the
 * size the native splash did. That shows up here as eyes in the wrong place, not as a crash.
 *
 * The component itself is only imported for its constants; reanimated is stubbed out so
 * that import costs nothing.
 */
jest.mock('react-native-reanimated', () => {
    const { View, Image } = require('react-native');

    return {
        __esModule: true,
        default: { View, Image, createAnimatedComponent: (Component: any) => Component },
        useSharedValue: (value: number) => ({ value }),
        useAnimatedStyle: (factory: any) => factory(),
        withTiming: (toValue: number) => toValue,
        withSequence: (...animations: any[]) => animations[animations.length - 1],
        runOnJS: (fn: any) => fn,
        Easing: { in: () => undefined, out: () => undefined, inOut: () => undefined, quad: undefined },
    };
});

import { ANDROID_SPLASH_CANVAS_SIZE, SPLASH_LOGO_EYES, splashLogoSize } from '../../main/components/SplashLogoSpinner';

/** What `assets/bootsplash/manifest.json` and `ios/Therr/BootSplash.storyboard` size the logo at. */
const MANIFEST_LOGO_SIZE = 100;

const asset = (relative: string) => path.resolve(__dirname, '../..', relative);

/** The artwork the overlay draws, at the densities where the eyes are large enough to measure. */
const LOGO_PNGS = {
    'the bundled JS copy': asset('main/assets/bootsplash_logo@4x.png'),
    'the Android splash drawable': asset('android/app/src/main/res/drawable-xxhdpi/bootsplash_logo.png'),
};

/** `drawable-<density>` folders, and the scale each one renders at. */
const ANDROID_DENSITIES: Array<[string, number]> = [
    ['mdpi', 1],
    ['hdpi', 1.5],
    ['xhdpi', 2],
    ['xxhdpi', 3],
    ['xxxhdpi', 4],
];

interface IBitmap {
    width: number;
    height: number;
    /** RGBA, 4 bytes per pixel, row-major. */
    pixels: Buffer;
}

/**
 * Minimal PNG reader: enough of the spec for the one file this suite measures — 8-bit RGBA,
 * non-interlaced. Deliberately dependency-free, like `__tests__/assets/therrIconFont.test.ts`;
 * an image library in the mobile package just to guard an asset is not worth it.
 */
const readPng = (file: Buffer): IBitmap => {
    const idat: Buffer[] = [];
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;

    // 8-byte signature, then a run of length-prefixed, type-tagged, CRC-suffixed chunks.
    let offset = 8;
    while (offset < file.length) {
        const length = file.readUInt32BE(offset);
        const type = file.toString('ascii', offset + 4, offset + 8);
        const data = file.subarray(offset + 8, offset + 8 + length);

        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data.readUInt8(8);
            colorType = data.readUInt8(9);
            interlace = data.readUInt8(12);
        } else if (type === 'IDAT') {
            idat.push(Buffer.from(data));
        } else if (type === 'IEND') {
            break;
        }

        offset += length + 12;
    }

    if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`Expected an 8-bit non-interlaced RGBA PNG, got bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
    }

    const bytesPerPixel = 4;
    const stride = width * bytesPerPixel;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const pixels = Buffer.alloc(stride * height);

    // Every scanline is prefixed with the filter it was encoded under, and is decoded
    // against the already-decoded pixel to its left (a) and the one above it (b/c).
    for (let y = 0; y < height; y += 1) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray((y * (stride + 1)) + 1, (y + 1) * (stride + 1));

        for (let x = 0; x < stride; x += 1) {
            const a = x >= bytesPerPixel ? pixels[(y * stride) + x - bytesPerPixel] : 0;
            const b = y > 0 ? pixels[((y - 1) * stride) + x] : 0;
            const c = (x >= bytesPerPixel && y > 0) ? pixels[((y - 1) * stride) + x - bytesPerPixel] : 0;
            let value = line[x];

            if (filter === 1) {
                value += a;
            } else if (filter === 2) {
                value += b;
            } else if (filter === 3) {
                value += Math.floor((a + b) / 2);
            } else if (filter === 4) {
                // Paeth: pick whichever neighbour the gradient a + b - c is closest to.
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                value += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
            } else if (filter !== 0) {
                throw new Error(`Unknown PNG scanline filter ${filter} on row ${y}`);
            }

            // Filters are defined modulo 256, and every operand above is an unsigned byte.
            pixels[(y * stride) + x] = value % 256;
        }
    }

    return { width, height, pixels };
};

const isOpaque = ([, , , alpha]: number[]) => alpha > 200;
const isWhite = (pixel: number[]) => isOpaque(pixel) && pixel[0] > 230 && pixel[1] > 230 && pixel[2] > 230;

/** The white of each eye, as a fraction-of-the-box center and diameter. */
const measureEyeWhites = (file: string) => {
    const bitmap = readPng(fs.readFileSync(file));

    const pixelAt = (x: number, y: number): number[] => {
        const at = (y * bitmap.width * 4) + (x * 4);
        return [bitmap.pixels[at], bitmap.pixels[at + 1], bitmap.pixels[at + 2], bitmap.pixels[at + 3]];
    };

    const halves: { left: number[][]; right: number[][] } = { left: [], right: [] };

    // The wordmark below is the logo's other white-adjacent region, so stay above it.
    for (let y = 0; y < bitmap.height * 0.7; y += 1) {
        for (let x = 0; x < bitmap.width; x += 1) {
            if (isWhite(pixelAt(x, y))) {
                halves[x < bitmap.width / 2 ? 'left' : 'right'].push([x, y]);
            }
        }
    }

    return Object.entries(halves).reduce((acc, [side, points]) => {
        if (!points.length) {
            throw new Error(`Found no eye white in the ${side} half of ${path.basename(file)} — has the logo been redrawn?`);
        }

        const xs = points.map(([x]) => x);
        const ys = points.map(([, y]) => y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            ...acc,
            [side]: {
                centerXRatio: ((minX + maxX + 1) / 2) / bitmap.width,
                centerYRatio: ((minY + maxY + 1) / 2) / bitmap.height,
                diameterRatio: (maxX - minX + 1) / bitmap.width,
                /** Height of the eye socket the lid may spill onto, measured up from the eye's center. */
                socketRadiusRatio: (() => {
                    const centerX = Math.round((minX + maxX) / 2);
                    const centerY = Math.round((minY + maxY) / 2);
                    let top = centerY;
                    while (top > 0 && isOpaque(pixelAt(centerX, top - 1))) {
                        top -= 1;
                    }
                    return (centerY - top) / bitmap.height;
                })(),
                /** Average color of the socket ringing the eye — what a closed lid has to match. */
                socketColor: (() => {
                    const centerX = (minX + maxX) / 2;
                    const centerY = (minY + maxY) / 2;
                    const radius = ((maxX - minX) / 2) * 1.35;
                    const samples: number[][] = [];

                    for (let angle = 0; angle < 360; angle += 15) {
                        const radians = (angle * Math.PI) / 180;
                        samples.push(pixelAt(
                            Math.round(centerX + (radius * Math.cos(radians))),
                            Math.round(centerY + (radius * Math.sin(radians))),
                        ));
                    }

                    return [0, 1, 2].map((channel) => Math.round(
                        samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length,
                    ));
                })(),
            },
        };
    }, {} as Record<string, {
        centerXRatio: number;
        centerYRatio: number;
        diameterRatio: number;
        socketRadiusRatio: number;
        socketColor: number[];
    }>);
};

const toChannels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));

const SIDES: Array<'left' | 'right'> = ['left', 'right'];

describe.each(Object.entries(LOGO_PNGS))('HABITS splash-logo eye geometry in %s', (_label, file) => {
    const measured = measureEyeWhites(file);

    it.each(SIDES)('centers the %s eyelid on the eye in the artwork', (side) => {
        expect(SPLASH_LOGO_EYES[side].centerXRatio).toBeCloseTo(measured[side].centerXRatio, 2);
        expect(SPLASH_LOGO_EYES.centerYRatio).toBeCloseTo(measured[side].centerYRatio, 2);
    });

    it.each(SIDES)('sizes the lid to cover the %s eye without leaving the socket', (side) => {
        // Wide enough to hide the whole white of the eye, including its antialiased edge...
        expect(SPLASH_LOGO_EYES.diameterRatio).toBeGreaterThanOrEqual(measured[side].diameterRatio);
        // ...but not so wide that a corner of the lid overhangs the head onto the background.
        expect(SPLASH_LOGO_EYES.diameterRatio / 2).toBeLessThanOrEqual(measured[side].socketRadiusRatio);
    });

    it.each(SIDES)('paints the %s lid in the color of the socket around it', (side) => {
        toChannels(SPLASH_LOGO_EYES[side].lidColor).forEach((channel, index) => {
            expect(Math.abs(channel - measured[side].socketColor[index])).toBeLessThanOrEqual(16);
        });
    });
});

describe('HABITS splash-logo overlay size', () => {
    it('redraws the logo at the size the native splash drew it, per platform', () => {
        // The storyboard pins its image view to the manifest size...
        expect(splashLogoSize('ios', 1)).toBe(MANIFEST_LOGO_SIZE);
        // ...while Android renders the whole canvas these drawables fill. Sizing both at the
        // manifest's 100dp is the bug this guards: the logo shrank 2.88x at the handoff.
        expect(splashLogoSize('android', 1)).toBe(ANDROID_SPLASH_CANVAS_SIZE);
    });

    it('follows the native icon down on Samsung One UI 4, which halves it', () => {
        expect(splashLogoSize('android', 0.5)).toBe(ANDROID_SPLASH_CANVAS_SIZE / 2);
        expect(splashLogoSize('ios', 0.5)).toBe(MANIFEST_LOGO_SIZE / 2);
    });
});

/**
 * The overlay draws its logo box at `ANDROID_SPLASH_CANVAS_SIZE` on Android because that is the
 * canvas the platform renders a splash logo in, and because these drawables are artwork filling
 * that canvas rather than a smaller logo centered inside one. Both halves of that reasoning are
 * load-bearing, so hold the committed drawables to both.
 */
describe('HABITS Android splash drawables', () => {
    it.each(ANDROID_DENSITIES)('is a %s canvas of the size the overlay assumes', (density, scale) => {
        const bitmap = readPng(fs.readFileSync(asset(`android/app/src/main/res/drawable-${density}/bootsplash_logo.png`)));

        expect(bitmap.width).toBe(ANDROID_SPLASH_CANVAS_SIZE * scale);
        expect(bitmap.height).toBe(bitmap.width);
    });

    it('fills that canvas with the artwork, rather than centering a smaller logo in it', () => {
        const drawable = readPng(fs.readFileSync(LOGO_PNGS['the Android splash drawable']));
        const bundled = readPng(fs.readFileSync(LOGO_PNGS['the bundled JS copy']));

        const artworkWidthRatio = ({ width, height, pixels }: IBitmap) => {
            let minX = width;
            let maxX = -1;

            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    if (pixels[(y * width * 4) + (x * 4) + 3] > 10) {
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                    }
                }
            }

            return (maxX - minX + 1) / width;
        };

        // Same framing in both bitmaps: the overlay swaps between them (and falls back from one to
        // the other) without the logo shifting or resizing.
        expect(artworkWidthRatio(drawable)).toBeCloseTo(artworkWidthRatio(bundled), 2);
        // The generator's own output would put the artwork at ~1/3 of the canvas.
        expect(artworkWidthRatio(drawable)).toBeGreaterThan(0.8);
    });
});
