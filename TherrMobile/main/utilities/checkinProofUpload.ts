import RNFB from 'react-native-blob-util';
import { FilePaths } from 'therr-js-utilities/constants';
import { signImageUrl } from './content';

export interface ISelectedProofImage {
    path: string;
    mime: string;
    size: number;
}

export interface IUploadedProofMedia {
    path: string;
    type: 'image';
    fileSizeBytes?: number;
}

/**
 * Upload a check-in proof photo to the private bucket and return the stored path in the shape
 * `POST /habits/checkins` expects under `proofMedias`.
 *
 * Extracted from the Dashboard and HabitDetail screens, which carried byte-identical copies,
 * so the check-in detail screen is the only caller of each entry point rather than a third
 * copy. The path is private — promoting a proof to a public post is a separate, moderated
 * copy (see the users-service SHARE handler).
 */
const uploadCheckinProofImage = (
    habitGoalId: string,
    image: ISelectedProofImage,
): Promise<IUploadedProofMedia> => {
    const extSplit = image.path?.split('.');
    const fileExtension = extSplit && extSplit.length > 1 ? extSplit[extSplit.length - 1] : 'jpeg';
    const filename = `${FilePaths.CONTENT}/habits_proof_${habitGoalId}_${Date.now()}.${fileExtension}`;

    return signImageUrl(false, { action: 'write', filename }).then((response: any) => {
        const signedUrl = response?.data?.url && response?.data?.url[0];
        const storedPath = response?.data?.path;
        return RNFB.fetch(
            'PUT',
            signedUrl,
            {
                'Content-Type': image.mime,
                'Content-Length': image.size.toString(),
                'Content-Disposition': 'inline',
            },
            RNFB.wrap(image.path),
        ).then(() => ({
            path: storedPath,
            type: 'image' as const,
            fileSizeBytes: image.size,
        }));
    });
};

export default uploadCheckinProofImage;
