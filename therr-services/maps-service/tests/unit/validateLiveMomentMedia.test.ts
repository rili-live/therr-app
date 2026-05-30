/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import { Content } from 'therr-js-utilities/constants';
import validateLiveMomentMedia from '../../src/utilities/validateLiveMomentMedia';

const still = { type: Content.mediaTypes.USER_IMAGE_PUBLIC, path: '/content/still.jpg' };
const clip = { type: Content.mediaTypes.USER_VIDEO_PUBLIC, path: '/content/clip.mp4' };

describe('validateLiveMomentMedia', () => {
    it('passes for empty / undefined media', () => {
        expect(validateLiveMomentMedia(undefined).isValid).to.equal(true);
        expect(validateLiveMomentMedia([]).isValid).to.equal(true);
    });

    it('passes for an image-only moment', () => {
        expect(validateLiveMomentMedia([still]).isValid).to.equal(true);
    });

    it('passes for a well-formed live moment (one still + one clip)', () => {
        expect(validateLiveMomentMedia([still, clip]).isValid).to.equal(true);
    });

    it('rejects more than one paired video', () => {
        const result = validateLiveMomentMedia([still, clip, clip]);
        expect(result.isValid).to.equal(false);
        expect(result.message).to.match(/at most one/i);
    });

    it('rejects a video clip with no sibling still', () => {
        const result = validateLiveMomentMedia([clip]);
        expect(result.isValid).to.equal(false);
        expect(result.message).to.match(/still image/i);
    });
});
