import { it, describe, expect } from '@jest/globals';
import { Content } from 'therr-js-utilities/constants';
import { getStillMedia, getVideoMedia, getIsLiveMoment } from '../../main/utilities/liveMomentMedia';

/**
 * Live Moments media-pairing helpers.
 *
 * A live moment stores a still image (medias[0]) alongside a short muted video clip as a
 * sibling medias[] entry. These tests lock in the selection logic that display + capture code
 * relies on, including backward compatibility with image-only moments.
 */

const still = { type: Content.mediaTypes.USER_IMAGE_PUBLIC, path: '/content/still.jpg', isLivePhoto: true };
const clip = { type: Content.mediaTypes.USER_VIDEO_PUBLIC, path: '/content/clip.mp4' };
const privateStill = { type: Content.mediaTypes.USER_IMAGE_PRIVATE, path: '/content/p.jpg' };

describe('liveMomentMedia helpers', () => {
    describe('getVideoMedia', () => {
        it('returns the video entry for a live moment', () => {
            expect(getVideoMedia([still, clip])).toBe(clip);
        });

        it('returns undefined for an image-only moment', () => {
            expect(getVideoMedia([still])).toBeUndefined();
        });

        it('handles empty / undefined input', () => {
            expect(getVideoMedia([])).toBeUndefined();
            expect(getVideoMedia(undefined)).toBeUndefined();
        });
    });

    describe('getStillMedia', () => {
        it('prefers an explicit image entry regardless of order', () => {
            expect(getStillMedia([clip, still])).toBe(still);
        });

        it('falls back to the first entry for legacy moments without a typed image', () => {
            const legacy = { path: '/content/legacy.jpg' };
            expect(getStillMedia([legacy as any])).toBe(legacy);
        });

        it('recognizes private images as stills', () => {
            expect(getStillMedia([clip, privateStill])).toBe(privateStill);
        });
    });

    describe('getIsLiveMoment', () => {
        it('is true only when a clip is present', () => {
            expect(getIsLiveMoment([still, clip])).toBe(true);
            expect(getIsLiveMoment([still])).toBe(false);
            expect(getIsLiveMoment(undefined)).toBe(false);
        });
    });
});
