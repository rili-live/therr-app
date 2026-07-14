import { it, describe, expect } from '@jest/globals';
import { Content } from 'therr-js-utilities/constants';
import { getMomentImageUris, isImageMedia, MAX_MOMENT_PHOTOS } from '../../main/utilities/content';

/**
 * Multi-photo moment URI resolution. A moment may carry 1..MAX_MOMENT_PHOTOS image entries;
 * these tests lock in the selection/cap logic the carousel relies on, including the private
 * image fallback to a signed URL cached in Redux.
 */

const pub = (n: number) => ({ type: Content.mediaTypes.USER_IMAGE_PUBLIC, path: `/content/p-${n}.jpg` });
const priv = (n: number) => ({ type: Content.mediaTypes.USER_IMAGE_PRIVATE, path: `/content/x-${n}.jpg` });
const video = { type: Content.mediaTypes.USER_VIDEO_PUBLIC, path: '/content/clip.mp4' };

describe('isImageMedia', () => {
    it('recognizes public and private images, rejects video', () => {
        expect(isImageMedia(pub(1))).toBe(true);
        expect(isImageMedia(priv(1))).toBe(true);
        expect(isImageMedia(video)).toBe(false);
        expect(isImageMedia(undefined)).toBe(false);
    });
});

describe('getMomentImageUris', () => {
    it('returns an empty array for no media', () => {
        expect(getMomentImageUris(undefined, {})).toEqual([]);
        expect(getMomentImageUris([], {})).toEqual([]);
    });

    it('resolves one URI per image, in order', () => {
        const uris = getMomentImageUris([pub(1), pub(2)], {});
        expect(uris).toHaveLength(2);
        expect(uris[0]).toContain('/content/p-1.jpg');
        expect(uris[1]).toContain('/content/p-2.jpg');
    });

    it('excludes non-image (video) entries', () => {
        const uris = getMomentImageUris([pub(1), video], {});
        expect(uris).toHaveLength(1);
    });

    it('caps at MAX_MOMENT_PHOTOS', () => {
        const media = Array.from({ length: MAX_MOMENT_PHOTOS + 3 }, (_, i) => pub(i));
        expect(getMomentImageUris(media, {})).toHaveLength(MAX_MOMENT_PHOTOS);
    });

    it('uses the signed-URL map for private images when available', () => {
        const signed = 'https://signed.example.com/x-1.jpg?token=abc';
        const uris = getMomentImageUris([priv(1)], { '/content/x-1.jpg': signed });
        expect(uris[0]).toBe(signed);
    });
});
