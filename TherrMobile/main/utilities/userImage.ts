import { Linking } from 'react-native';
import RNFB from 'react-native-blob-util';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { FilePaths } from 'therr-js-utilities/constants';
import { signImageUrl } from './content';
import { showToast } from './toasts';

export type UserImageFailureStage = 'pick' | 'crop' | 'upload';

export type ImagePickerErrorKind = 'cancelled' | 'permission' | 'failed';

/**
 * react-native-image-crop-picker rejects with a `code` on both platforms (E_PICKER_CANCELLED,
 * E_NO_LIBRARY_PERMISSION, E_NO_IMAGE_DATA_FOUND, ...). The message is only a fallback for
 * rejections that do not carry one — and it can be missing entirely, so never call a string
 * method on it unguarded.
 */
export const classifyImagePickerError = (err: any): ImagePickerErrorKind => {
    const code = String(err?.code || '');
    const message = String(err?.message || '').toLowerCase();

    if (code === 'E_PICKER_CANCELLED' || message.includes('cancel')) {
        return 'cancelled';
    }
    if (code.includes('PERMISSION') || message.includes('permission')) {
        return 'permission';
    }

    return 'failed';
};

/**
 * `user_image_upload_error` used to fire on every picker rejection, including a plain back
 * press, so it read as a failure rate it never was. It now fires only for real failures, and
 * says where (`stage`) and why (`code`).
 */
export const reportUserImageFailure = ({
    stage,
    err,
    userId,
    translate,
}: {
    stage: UserImageFailureStage;
    err: any;
    userId?: string;
    translate: Function;
}) => {
    const kind = stage === 'upload' ? 'failed' : classifyImagePickerError(err);
    if (kind === 'cancelled') {
        return;
    }

    logEvent(getAnalytics(), 'user_image_upload_error', {
        stage,
        code: String(err?.code || err?.status || 'unknown').slice(0, 100),
        userId,
    }).catch(() => {});

    if (kind === 'permission') {
        showToast.error({
            text1: translate('alertTitles.permissionsDenied'),
            text2: translate('alertMessages.cameraOrFilePermissionsDenied'),
            onPress: () => { Linking.openSettings().catch(() => {}); },
        });
        return;
    }

    showToast.error({
        text1: translate('alertTitles.profilePhotoNotSaved'),
        text2: translate(stage === 'upload'
            ? 'alertMessages.profilePhotoUploadFailed'
            : 'alertMessages.profilePhotoPickFailed'),
    });
};

/**
 * Signs a public-bucket write URL for the profile picture and PUTs the file to it.
 * Resolves with the sign response's data (`path` is what the user record stores).
 *
 * react-native-blob-util resolves on any HTTP response, so a 403 from an expired signature
 * used to "succeed" and point the profile at a file that was never written. A non-2xx
 * status is a rejection here.
 */
export const uploadProfilePicture = (image: { path?: string; mime?: string; size?: number }) => {
    const filePathSplit = image?.path?.split('.');
    const fileExtension = filePathSplit?.[filePathSplit.length - 1] || 'jpeg';

    return signImageUrl(true, {
        action: 'write',
        filename: `${FilePaths.PROFILE_PICTURE}.${fileExtension}`,
    }).then((response) => {
        const signedUrl = response?.data?.url && response?.data?.url[0];
        if (!signedUrl) {
            return Promise.reject({ code: 'E_NO_SIGNED_URL' });
        }

        // TODO: Abstract and add nudity filter sightengine.com
        return RNFB.fetch(
            'PUT',
            signedUrl,
            {
                'Content-Type': image.mime || 'image/jpeg',
                'Content-Length': String(image.size),
                'Content-Disposition': 'inline',
            },
            RNFB.wrap(`${image?.path}`),
        ).then((uploadResponse) => {
            const status = uploadResponse?.info?.()?.status;
            if (status && (status < 200 || status >= 300)) {
                return Promise.reject({ code: `HTTP_${status}`, status });
            }

            return response?.data;
        });
    });
};
