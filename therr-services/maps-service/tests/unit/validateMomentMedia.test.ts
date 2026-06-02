/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import { Content } from 'therr-js-utilities/constants';
import validateMomentMedia, { MAX_MOMENT_PHOTOS } from '../../src/utilities/validateMomentMedia';

const photo = (n: number) => ({ type: Content.mediaTypes.USER_IMAGE_PUBLIC, path: `/content/photo-${n}.jpg` });
const clip = { type: Content.mediaTypes.USER_VIDEO_PUBLIC, path: '/content/clip.mp4' };

describe('validateMomentMedia', () => {
    it('passes for empty / undefined media', () => {
        expect(validateMomentMedia(undefined).isValid).to.equal(true);
        expect(validateMomentMedia([]).isValid).to.equal(true);
    });

    it('passes for a single photo', () => {
        expect(validateMomentMedia([photo(1)]).isValid).to.equal(true);
    });

    it('passes for the max number of photos', () => {
        const media = Array.from({ length: MAX_MOMENT_PHOTOS }, (_, i) => photo(i));
        expect(validateMomentMedia(media).isValid).to.equal(true);
    });

    it('rejects more than the max number of photos', () => {
        const media = Array.from({ length: MAX_MOMENT_PHOTOS + 1 }, (_, i) => photo(i));
        const result = validateMomentMedia(media);
        expect(result.isValid).to.equal(false);
        expect(result.message).to.match(/at most/i);
    });

    it('rejects non-image media (video is deferred)', () => {
        const result = validateMomentMedia([photo(1), clip]);
        expect(result.isValid).to.equal(false);
        expect(result.message).to.match(/photos only/i);
    });
});
