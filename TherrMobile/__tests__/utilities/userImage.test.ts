// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';
import RNFB from 'react-native-blob-util';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { signImageUrl } from '../../main/utilities/content';
import { showToast } from '../../main/utilities/toasts';
import {
    classifyImagePickerError,
    reportUserImageFailure,
    uploadProfilePicture,
} from '../../main/utilities/userImage';

/**
 * Profile photo pick + upload
 *
 * `user_image_upload_error` reached ~20 Friends with Habits users in the six weeks to
 * 27 Sep 2026, and nothing about it was actionable: it fired on a plain back press, the user
 * saw nothing on a real failure, and an upload that storage refused with a 403 still
 * "succeeded". These pin the three halves of the fix.
 */

jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn(),
    wrap: jest.fn((path: string) => `wrapped:${path}`),
}));

jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../main/utilities/content', () => ({
    signImageUrl: jest.fn(),
}));

jest.mock('../../main/utilities/toasts', () => ({
    showToast: { error: jest.fn() },
}));

const translate = (key: string) => key;
const image = { path: 'file:///tmp/abc.jpg', mime: 'image/jpeg', size: 1234 };

beforeEach(() => {
    jest.clearAllMocks();
    (signImageUrl as jest.Mock).mockReturnValue(Promise.resolve({
        data: { url: ['https://signed.example/put'], path: 'user/profile.jpg' },
    }));
});

describe('classifyImagePickerError', () => {
    it('treats a back press as a cancel, not a failure', () => {
        expect(classifyImagePickerError({ code: 'E_PICKER_CANCELLED', message: 'User cancelled image selection' })).toBe('cancelled');
    });

    it('recognises denied library and camera permission by code', () => {
        expect(classifyImagePickerError({ code: 'E_NO_LIBRARY_PERMISSION' })).toBe('permission');
        expect(classifyImagePickerError({ code: 'E_NO_CAMERA_PERMISSION' })).toBe('permission');
    });

    it('does not throw on a rejection with no message', () => {
        expect(classifyImagePickerError({ code: 'E_NO_IMAGE_DATA_FOUND' })).toBe('failed');
        expect(classifyImagePickerError(undefined)).toBe('failed');
    });
});

describe('reportUserImageFailure', () => {
    it('logs nothing and shows nothing for a cancel', () => {
        reportUserImageFailure({ stage: 'pick', err: { code: 'E_PICKER_CANCELLED' }, userId: 'u1', translate });

        expect(logEvent).not.toHaveBeenCalled();
        expect(showToast.error).not.toHaveBeenCalled();
    });

    it('logs the stage and code of a real failure and tells the user', () => {
        reportUserImageFailure({ stage: 'pick', err: { code: 'E_NO_IMAGE_DATA_FOUND' }, userId: 'u1', translate });

        expect(logEvent).toHaveBeenCalledWith(getAnalytics(), 'user_image_upload_error', {
            stage: 'pick',
            code: 'E_NO_IMAGE_DATA_FOUND',
            userId: 'u1',
        });
        expect(showToast.error).toHaveBeenCalledWith(expect.objectContaining({
            text2: 'alertMessages.profilePhotoPickFailed',
        }));
    });

    it('points a permission denial at the device settings', () => {
        reportUserImageFailure({ stage: 'pick', err: { code: 'E_NO_LIBRARY_PERMISSION' }, userId: 'u1', translate });

        expect(showToast.error).toHaveBeenCalledWith(expect.objectContaining({
            text2: 'alertMessages.cameraOrFilePermissionsDenied',
            onPress: expect.any(Function),
        }));
    });

    it('never classifies an upload failure as a cancel', () => {
        reportUserImageFailure({ stage: 'upload', err: { message: 'Request cancelled' }, userId: 'u1', translate });

        expect(logEvent).toHaveBeenCalled();
        expect(showToast.error).toHaveBeenCalledWith(expect.objectContaining({
            text2: 'alertMessages.profilePhotoUploadFailed',
        }));
    });
});

describe('uploadProfilePicture', () => {
    it('resolves with the signed path when storage accepts the PUT', async () => {
        (RNFB.fetch as jest.Mock).mockReturnValue(Promise.resolve({ info: () => ({ status: 200 }) }));

        await expect(uploadProfilePicture(image)).resolves.toEqual({
            url: ['https://signed.example/put'],
            path: 'user/profile.jpg',
        });
        expect(signImageUrl).toHaveBeenCalledWith(true, { action: 'write', filename: expect.stringMatching(/\.jpg$/) });
    });

    it('rejects when storage refuses the PUT, instead of saving a path to a missing file', async () => {
        (RNFB.fetch as jest.Mock).mockReturnValue(Promise.resolve({ info: () => ({ status: 403 }) }));

        await expect(uploadProfilePicture(image)).rejects.toEqual({ code: 'HTTP_403', status: 403 });
    });

    it('rejects without uploading when no signed URL comes back', async () => {
        (signImageUrl as jest.Mock).mockReturnValue(Promise.resolve({ data: {} }));

        await expect(uploadProfilePicture(image)).rejects.toEqual({ code: 'E_NO_SIGNED_URL' });
        expect(RNFB.fetch).not.toHaveBeenCalled();
    });

    it('falls back to a jpeg extension rather than "undefined" when the path has none', async () => {
        (RNFB.fetch as jest.Mock).mockReturnValue(Promise.resolve({ info: () => ({ status: 200 }) }));

        await uploadProfilePicture({ mime: 'image/jpeg', size: 1 });

        expect(signImageUrl).toHaveBeenCalledWith(true, { action: 'write', filename: expect.stringMatching(/\.jpeg$/) });
    });
});
