import ImageCropPicker from 'react-native-image-crop-picker';
import { createThumbnail } from 'react-native-create-thumbnail';

// Keep Live clips short for performance, storage, and a "moving picture" (not a video) feel.
export const MAX_LIVE_CLIP_SECONDS = 3;

export interface ILiveMomentCapture {
    // The extracted still key-frame (image), used as medias[0] / poster.
    still: { path: string; mime: string; size: number; width?: number; height?: number };
    // The recorded/selected clip (video), uploaded as the sibling medias[] entry.
    video: { path: string; mime: string; size: number; duration?: number };
}

/**
 * Phase 1 Live Moment capture: record or select a short clip via the already-installed
 * image-crop-picker, then derive a still key-frame from it. Returns null when the device/native
 * modules can't produce a clip+still so callers can fall back to the normal photo flow.
 *
 * Phase 2 (see docs/LIVE_MOMENTS_PLAN.md) replaces this with a custom native importer for true
 * device Live/Motion Photos and press-and-hold recording via vision-camera.
 */
const captureLiveMoment = async (action: string): Promise<ILiveMomentCapture | null> => {
    const videoOptions: any = {
        mediaType: 'video',
        includeBase64: false,
        multiple: false,
        compressVideoPreset: 'MediumQuality',
    };

    let clip: any;
    try {
        clip = action === 'camera'
            ? await ImageCropPicker.openCamera(videoOptions)
            : await ImageCropPicker.openPicker(videoOptions);
    } catch (err: any) {
        // Cancellation is expected — bubble up so the caller treats it as "no selection".
        if (err?.message?.toLowerCase().includes('cancel')) {
            throw err;
        }
        return null;
    }

    if (!clip?.path) {
        return null;
    }

    // Derive the still poster from the first frame. If frame extraction isn't available
    // (e.g. native module not linked yet), signal failure so the caller can fall back.
    try {
        const thumbnail = await createThumbnail({
            url: clip.path,
            timeStamp: 0,
            format: 'jpeg',
        });

        return {
            still: {
                path: thumbnail.path,
                mime: 'image/jpeg',
                size: 0,
                width: thumbnail.width,
                height: thumbnail.height,
            },
            video: {
                path: clip.path,
                mime: clip.mime || 'video/mp4',
                size: clip.size || 0,
                duration: clip.duration,
            },
        };
    } catch {
        return null;
    }
};

export default captureLiveMoment;
