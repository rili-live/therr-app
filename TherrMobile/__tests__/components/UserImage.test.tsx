import 'react-native';
import React from 'react';
import ImageCropPicker from 'react-native-image-crop-picker';
import { logEvent } from '@react-native-firebase/analytics';
import UserImage from '../../main/components/UserContent/UserImage';
import { reportUserImageFailure } from '../../main/utilities/userImage';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';

/**
 * The picker used to crop inside `openPicker`, so a photo the cropper could not open lost
 * the whole selection, and the handler reopened the same picker on the same photo. Picking
 * and cropping are now separate, and a crop failure keeps the picked photo.
 */

jest.mock('react-native-image-crop-picker', () => ({
    openPicker: jest.fn(),
    openCropper: jest.fn(),
}));

jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn(),
    wrap: jest.fn(),
}));

jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../main/utilities/userImage', () => ({
    ...(jest.requireActual('../../main/utilities/userImage') as object),
    reportUserImageFailure: jest.fn(),
}));

jest.mock('../../main/components/BaseImage', () => () => null);
jest.mock('react-native-vector-icons/MaterialIcons', () => () => null);

const picked = { path: 'file:///tmp/picked.jpg', mime: 'image/jpeg', size: 10 };
const cropped = { path: 'file:///tmp/cropped.jpg', mime: 'image/jpeg', size: 5 };
const user = { details: { id: 'u1' } };
const theme = { colors: { accentTextWhite: '#fff' } };
const themeForms = { styles: {} };

const pressAndSettle = async (onImageReady: jest.Mock) => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <UserImage
                user={user}
                onImageReady={onImageReady}
                translate={(key: string) => key}
                theme={theme}
                themeForms={themeForms}
                userImageUri="https://example.com/me.jpg"
            />,
        );
    });
    await act(async () => {
        tree!.root.findAll((node) => typeof node.props.onPress === 'function')[0].props.onPress();
    });
    await act(async () => {
        tree!.unmount();
    });
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('UserImage', () => {
    it('picks with compression, then crops the picked file', async () => {
        (ImageCropPicker.openPicker as jest.Mock).mockResolvedValue(picked);
        (ImageCropPicker.openCropper as jest.Mock).mockResolvedValue(cropped);
        const onImageReady = jest.fn();

        await pressAndSettle(onImageReady);

        expect(ImageCropPicker.openPicker).toHaveBeenCalledWith(expect.objectContaining({
            cropping: false,
            compressImageMaxWidth: expect.any(Number),
        }));
        expect(ImageCropPicker.openCropper).toHaveBeenCalledWith(expect.objectContaining({ path: picked.path }));
        expect(onImageReady).toHaveBeenCalledWith(cropped);
    });

    it('keeps the picked photo when the cropper cannot open it', async () => {
        (ImageCropPicker.openPicker as jest.Mock).mockResolvedValue(picked);
        (ImageCropPicker.openCropper as jest.Mock).mockRejectedValue({ code: 'E_NO_IMAGE_DATA_FOUND', message: 'Cannot find image data' });
        const onImageReady = jest.fn();

        await pressAndSettle(onImageReady);

        expect(onImageReady).toHaveBeenCalledWith(picked);
        expect(ImageCropPicker.openPicker).toHaveBeenCalledTimes(1);
        expect(logEvent).toHaveBeenCalledWith({}, 'user_image_crop_fallback', expect.objectContaining({ code: 'E_NO_IMAGE_DATA_FOUND' }));
    });

    it('treats backing out of the cropper as a cancel', async () => {
        (ImageCropPicker.openPicker as jest.Mock).mockResolvedValue(picked);
        (ImageCropPicker.openCropper as jest.Mock).mockRejectedValue({ code: 'E_PICKER_CANCELLED', message: 'User cancelled image selection' });
        const onImageReady = jest.fn();

        await pressAndSettle(onImageReady);

        expect(onImageReady).toHaveBeenCalledWith({ didCancel: true });
        expect(logEvent).not.toHaveBeenCalled();
    });

    it('hands a picker failure to the reporter and does not reopen the picker', async () => {
        const err = { code: 'E_NO_LIBRARY_PERMISSION', message: 'User did not grant library permission.' };
        (ImageCropPicker.openPicker as jest.Mock).mockRejectedValue(err);
        const onImageReady = jest.fn();

        await pressAndSettle(onImageReady);

        expect(reportUserImageFailure).toHaveBeenCalledWith(expect.objectContaining({ stage: 'pick', err, userId: 'u1' }));
        expect(ImageCropPicker.openPicker).toHaveBeenCalledTimes(1);
        expect(ImageCropPicker.openCropper).not.toHaveBeenCalled();
        expect(onImageReady).toHaveBeenCalledWith({ didCancel: true });
    });
});
