import { it, describe, expect, jest, beforeEach } from '@jest/globals';

// Mock the native picker so we can drive the capture flow deterministically.
const mockOpenCamera = jest.fn();
const mockOpenPicker = jest.fn();
jest.mock('react-native-image-crop-picker', () => ({
    __esModule: true,
    default: {
        openCamera: (...args: any[]) => mockOpenCamera(...args),
        openPicker: (...args: any[]) => mockOpenPicker(...args),
    },
}));

// createThumbnail is mapped to the shared mock (returns a fake thumbnail path).
import captureLiveMoment from '../../main/utilities/captureLiveMoment';

const clip = { path: 'file:///tmp/clip.mp4', mime: 'video/mp4', size: 1234, duration: 2.5 };

describe('captureLiveMoment', () => {
    beforeEach(() => {
        mockOpenCamera.mockReset();
        mockOpenPicker.mockReset();
    });

    it('records a clip + still via the camera and pairs them', async () => {
        mockOpenCamera.mockResolvedValue(clip);

        const result = await captureLiveMoment('camera');

        expect(mockOpenCamera).toHaveBeenCalledTimes(1);
        expect(result?.video.path).toBe(clip.path);
        expect(result?.video.mime).toBe('video/mp4');
        expect(result?.still.path).toBe('file:///tmp/mock-thumbnail.jpg');
        expect(result?.still.mime).toBe('image/jpeg');
    });

    it('uses the gallery picker for non-camera actions', async () => {
        mockOpenPicker.mockResolvedValue(clip);

        const result = await captureLiveMoment('upload');

        expect(mockOpenPicker).toHaveBeenCalledTimes(1);
        expect(result?.video.path).toBe(clip.path);
    });

    it('returns null when no clip is produced (caller falls back to photo)', async () => {
        mockOpenCamera.mockResolvedValue({});

        const result = await captureLiveMoment('camera');

        expect(result).toBeNull();
    });

    it('re-throws cancellation so the caller treats it as no-selection', async () => {
        mockOpenCamera.mockRejectedValue(new Error('User cancelled image selection'));

        await expect(captureLiveMoment('camera')).rejects.toThrow(/cancel/i);
    });
});
